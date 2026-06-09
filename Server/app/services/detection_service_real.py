import subprocess
import shutil
import os
import asyncio
import logging
import queue
import cv2
import numpy as np
from datetime import datetime
from threading import Thread

logger = logging.getLogger(__name__)

HLS_DIR = "hls_streams"
os.makedirs(HLS_DIR, exist_ok=True)

_base = os.path.dirname(__file__)
MODEL_PATH = os.path.join(_base, "..", "..", "best.pt")
if not os.path.exists(MODEL_PATH):
    MODEL_PATH = os.path.join(_base, "..", "..", "..", "best.pt")

VIDEO_FALLBACK = os.path.join(_base, "..", "..", "..", "teste.mp4")

CLASSE_PESSOA = {"person"}

CLASSES_EPI = {
    "glasses",
    "face-mask-medical",
    "face-guard",
    "earmuffs",
    "gloves",
    "safety-vest",
    "helmet",
    "medical-suit",
    "safety-suit",
}

# EPI obrigatório padrão (fallback caso o setor não tenha required_epis configurado)
EPIS_OBRIGATORIOS_DEFAULT = {"helmet"}

CONFIANCA_MINIMA = 0.50
INTERVALO_SALVAR = 600
YOLO_INTERVALO   = 0.3

FRAME_MAX_WIDTH  = 1280
FRAME_MAX_HEIGHT = 720

processos_ffmpeg: dict[int, subprocess.Popen] = {}
tarefas_deteccao: dict[int, asyncio.Task]     = {}

_model = None

FFMPEG_BIN = (
    shutil.which("ffmpeg")
    or r"C:\ProgramData\chocolatey\bin\ffmpeg.exe"
)


def _normalizar_frame(frame: np.ndarray) -> np.ndarray:
    h, w = frame.shape[:2]
    if w > FRAME_MAX_WIDTH or h > FRAME_MAX_HEIGHT:
        scale = min(FRAME_MAX_WIDTH / w, FRAME_MAX_HEIGHT / h)
        novo_w = int(w * scale)
        novo_h = int(h * scale)
        frame = cv2.resize(frame, (novo_w, novo_h), interpolation=cv2.INTER_AREA)
    if len(frame.shape) == 2:
        frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
    return frame


def _abrir_captura_legada(url: str) -> cv2.VideoCapture:
    cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
    if cap.isOpened():
        return cap

    if isinstance(url, str) and (url.startswith("rtsp://") or url.startswith("rtsps://")):
        os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;udp")
        cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
        if cap.isOpened():
            return cap
        del os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"]

        url_http = url.replace("rtsp://", "http://").replace("rtsps://", "https://")
        cap = cv2.VideoCapture(url_http)
        if cap.isOpened():
            return cap

    cap = cv2.VideoCapture(url)
    return cap


def get_model():
    global _model
    if _model is None:
        try:
            from ultralytics import YOLO
            _model = YOLO(MODEL_PATH)
            logger.info(f"[YOLO] Modelo carregado: {os.path.abspath(MODEL_PATH)}")
            logger.info(f"[YOLO] Classes: {_model.names}")
        except Exception as e:
            logger.error(f"[YOLO] Erro ao carregar modelo: {e}")
            _model = None
    return _model


def iniciar_hls(camera_id: int, rtsp_url: str):
    pasta = os.path.join(HLS_DIR, str(camera_id))
    os.makedirs(pasta, exist_ok=True)
    m3u8 = os.path.join(pasta, "index.m3u8")

    if camera_id in processos_ffmpeg:
        if processos_ffmpeg[camera_id].poll() is None:
            return
        del processos_ffmpeg[camera_id]

    if not FFMPEG_BIN:
        logger.error("[HLS] ffmpeg não encontrado!")
        return

    cmd_tcp = [
        FFMPEG_BIN,
        "-rtsp_transport", "tcp",
        "-i", rtsp_url,
        "-c:v", "copy",
        "-an",
        "-hls_time", "2",
        "-hls_list_size", "5",
        "-hls_flags", "delete_segments",
        "-y", m3u8,
    ]

    cmd_legado = [
        FFMPEG_BIN,
        "-rtsp_transport", "udp",
        "-allowed_media_types", "video",
        "-vf", f"scale='min({FRAME_MAX_WIDTH},iw)':'min({FRAME_MAX_HEIGHT},ih)'",
        "-i", rtsp_url,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-tune", "zerolatency",
        "-profile:v", "baseline",
        "-level", "3.0",
        "-an",
        "-hls_time", "2",
        "-hls_list_size", "5",
        "-hls_flags", "delete_segments",
        "-y", m3u8,
    ]

    for cmd in (cmd_tcp, cmd_legado):
        try:
            proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            processos_ffmpeg[camera_id] = proc
            logger.info(f"[HLS] Iniciado câmera {camera_id}")
            return
        except Exception as e:
            logger.warning(f"[HLS] Tentativa falhou ({cmd[3]}): {e}")

    logger.error(f"[HLS] Não foi possível iniciar stream para câmera {camera_id}")


def parar_hls(camera_id: int):
    proc = processos_ffmpeg.pop(camera_id, None)
    if proc:
        proc.terminate()
    task = tarefas_deteccao.pop(camera_id, None)
    if task:
        task.cancel()
    logger.info(f"[CAM {camera_id}] Stream e detecção encerrados.")


async def buscar_epis_obrigatorios(sector_id: int) -> set[str]:
    """
    Busca os EPIs obrigatórios do setor no banco de dados.
    Os valores em required_epis devem ser nomes de classes YOLO (ex: 'helmet', 'gloves').
    Retorna EPIS_OBRIGATORIOS_DEFAULT se o setor não tiver EPIs configurados.
    """
    try:
        from app.core.database import AsyncSessionLocal
        from app.models.sector import Sector
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Sector).where(Sector.id == sector_id))
            sector = result.scalar_one_or_none()

        if sector and sector.required_epis:
            # Filtra apenas classes que o modelo conhece
            epis_validos = {e.lower() for e in sector.required_epis} & CLASSES_EPI
            if epis_validos:
                logger.info(f"[SETOR {sector_id}] EPIs obrigatórios: {epis_validos}")
                return epis_validos

        logger.warning(
            f"[SETOR {sector_id}] Nenhum EPI configurado ou inválido "
            f"— usando padrão: {EPIS_OBRIGATORIOS_DEFAULT}"
        )
        return EPIS_OBRIGATORIOS_DEFAULT

    except Exception as e:
        logger.error(f"[SETOR {sector_id}] Erro ao buscar EPIs: {e}")
        return EPIS_OBRIGATORIOS_DEFAULT


class FrameReader(Thread):

    def __init__(self, fonte: str, camera_id: int):
        super().__init__(daemon=True)
        self.fonte     = fonte
        self.camera_id = camera_id
        self.frame_q   = queue.Queue(maxsize=1)
        self.running   = True
        self.frame_num = 0

    def run(self):
        logger.info(f"[CAM {self.camera_id}] FrameReader tentando: {self.fonte}")
        cap = _abrir_captura_legada(self.fonte)

        if not cap.isOpened():
            fallback = os.path.abspath(VIDEO_FALLBACK)
            logger.warning(f"[CAM {self.camera_id}] Fonte falhou → fallback: {fallback}")
            self.fonte = fallback
            cap = cv2.VideoCapture(self.fonte)

        if not cap.isOpened():
            logger.error(f"[CAM {self.camera_id}] Não abriu nenhuma fonte!")
            return

        logger.info(f"[CAM {self.camera_id}] FrameReader OK → {self.fonte}")

        while self.running:
            ret, frame = cap.read()
            if not ret:
                if "teste.mp4" in self.fonte:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                logger.warning(f"[CAM {self.camera_id}] Frame perdido — reconectando em 3s...")
                cap.release()
                import time; time.sleep(3)
                cap = _abrir_captura_legada(self.fonte)
                if not cap.isOpened():
                    cap = cv2.VideoCapture(os.path.abspath(VIDEO_FALLBACK))
                continue

            frame = _normalizar_frame(frame)
            self.frame_num += 1
            try:
                self.frame_q.get_nowait()
            except queue.Empty:
                pass
            self.frame_q.put((self.frame_num, frame))

        cap.release()
        logger.info(f"[CAM {self.camera_id}] FrameReader encerrado.")

    def stop(self):
        self.running = False


def inferir_frame(frame: np.ndarray) -> list[dict]:
    model = get_model()
    if model is None:
        return []
    results = model(frame, conf=CONFIANCA_MINIMA, verbose=False)
    deteccoes = []
    for r in results:
        for box in r.boxes:
            nome = model.names[int(box.cls)].lower()
            deteccoes.append({
                "class":      nome,
                "confidence": round(float(box.conf), 4),
                "bbox":       box.xyxy[0].tolist(),
            })
    return deteccoes


def avaliar_deteccoes(deteccoes: list[dict], epis_obrigatorios: set[str] | None = None) -> dict:
    """
    Avalia as detecções do frame contra os EPIs obrigatórios do setor.

    Args:
        deteccoes: Lista de detecções do YOLO.
        epis_obrigatorios: Conjunto de classes YOLO obrigatórias para o setor.
                           Se None, usa EPIS_OBRIGATORIOS_DEFAULT.
    """
    if epis_obrigatorios is None:
        epis_obrigatorios = EPIS_OBRIGATORIOS_DEFAULT

    classes          = {d["class"] for d in deteccoes}
    pessoa_detectada = bool(classes & CLASSE_PESSOA)
    epis_encontrados = classes & CLASSES_EPI
    epis_ausentes    = epis_obrigatorios - epis_encontrados

    if not pessoa_detectada:
        status = "sem_pessoa"
    elif not epis_ausentes:
        status = "conforme"
    else:
        status = "nao_conforme"

    confianca = max((d["confidence"] for d in deteccoes), default=0.0)

    return {
        "status":              status,
        "epi_detected":        list(epis_encontrados),
        "epis_ausentes":       list(epis_ausentes),
        "epis_obrigatorios":   list(epis_obrigatorios),
        "pessoa_detectada":    pessoa_detectada,
        "confidence":          confianca,
        "detections":          deteccoes,
    }


async def salvar_ocorrencia(camera_id: int, sector_id: int, resultado: dict, frame: np.ndarray):
    from app.core.database import AsyncSessionLocal
    from app.models.occurrence import Occurrence, OccurrenceStatus
    from app.models.notification import Notification
    from app.models.user import User, UserRole
    from sqlalchemy import select

    image_path = None
    try:
        img_dir    = f"hls_streams/{camera_id}/frames"
        os.makedirs(img_dir, exist_ok=True)
        image_path = f"{img_dir}/{int(datetime.utcnow().timestamp())}.jpg"
        cv2.imwrite(image_path, frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    except Exception as e:
        logger.warning(f"[CAM {camera_id}] Erro ao salvar frame: {e}")

    try:
        async with AsyncSessionLocal() as db:
            occ = Occurrence(
                camera_id    = camera_id,
                sector_id    = sector_id,
                status       = OccurrenceStatus.nao_conforme,
                epi_detected = resultado["epi_detected"],
                confidence   = resultado["confidence"],
                image_path   = image_path,
                timestamp    = datetime.utcnow(),
            )
            db.add(occ)
            await db.flush()

            ausentes_str = ", ".join(resultado["epis_ausentes"]) or "EPI não identificado"
            texto = (
                f"⚠️ Pessoa sem EPI — Câmera {camera_id} | "
                f"Faltando: {ausentes_str} | "
                f"Confiança: {resultado['confidence'] * 100:.0f}%"
            )

            res = await db.execute(
                select(User).where(
                    User.role == UserRole.gestor,
                    User.is_active == True,
                )
            )
            gestores = res.scalars().all()
            logger.info(f"[CAM {camera_id}] Gestores para notificar: {len(gestores)}")

            for g in gestores:
                db.add(Notification(
                    user_id = g.id,
                    tipo    = "err",
                    texto   = texto,
                    lida    = False,
                ))

            await db.commit()
            logger.info(
                f"[CAM {camera_id}] Ocorrência #{occ.id} salva | "
                f"Faltando: {resultado['epis_ausentes']} | "
                f"Notificados: {len(gestores)} gestor(es)"
            )
    except Exception as e:
        logger.error(f"[CAM {camera_id}] Erro ao salvar ocorrência: {e}", exc_info=True)


async def processar_stream_camera(camera_id: int, rtsp_url: str, sector_id: int):
    logger.info(f"[CAM {camera_id}] Iniciando detecção real-time → {rtsp_url}")

    # Busca EPIs obrigatórios do setor UMA vez ao iniciar a câmera
    epis_obrigatorios = await buscar_epis_obrigatorios(sector_id)

    reader      = FrameReader(rtsp_url, camera_id)
    reader.start()
    ultimo_save = datetime.min
    ultimo_reload_epis = datetime.utcnow()
    loop        = asyncio.get_event_loop()

    try:
        while True:
            await asyncio.sleep(YOLO_INTERVALO)

            # Recarrega EPIs obrigatórios a cada 5 minutos (para capturar mudanças no banco)
            agora = datetime.utcnow()
            if (agora - ultimo_reload_epis).total_seconds() > 300:
                epis_obrigatorios = await buscar_epis_obrigatorios(sector_id)
                ultimo_reload_epis = agora

            try:
                frame_num, frame = reader.frame_q.get(timeout=2)
            except queue.Empty:
                logger.warning(f"[CAM {camera_id}] Sem frames na queue — aguardando...")
                continue

            deteccoes = await loop.run_in_executor(None, inferir_frame, frame)
            resultado  = avaliar_deteccoes(deteccoes, epis_obrigatorios)

            logger.info(
                f"[CAM {camera_id}] Frame {frame_num:05d} | "
                f"status={resultado['status']} | "
                f"EPIs={resultado['epi_detected']} | "
                f"obrigatórios={resultado['epis_obrigatorios']} | "
                f"faltando={resultado['epis_ausentes']} | "
                f"conf={resultado['confidence']:.2f}"
            )

            if resultado["status"] != "nao_conforme":
                continue

            if (agora - ultimo_save).total_seconds() < INTERVALO_SALVAR:
                continue

            await salvar_ocorrencia(camera_id, sector_id, resultado, frame)
            ultimo_save = agora

    except asyncio.CancelledError:
        logger.info(f"[CAM {camera_id}] Detecção cancelada.")
    finally:
        reader.stop()


async def start_camera_streams():
    await asyncio.sleep(2)

    logger.info(">>> [STARTUP] start_camera_streams chamado <<<")

    try:
        from app.core.database import AsyncSessionLocal
        from app.models.camera import Camera
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            result  = await db.execute(select(Camera).where(Camera.is_active == True))
            cameras = result.scalars().all()

        logger.info(f"[STARTUP] {len(cameras)} câmera(s) ativa(s) encontrada(s).")

        model_existe = os.path.exists(MODEL_PATH)
        logger.info(f"[STARTUP] best.pt encontrado: {model_existe} → {os.path.abspath(MODEL_PATH)}")

        for cam in cameras:
            url = cam.rtsp_url if cam.rtsp_url else os.path.abspath(VIDEO_FALLBACK)
            logger.info(f"[STARTUP] Câmera {cam.id} ({cam.name}) → {url}")

            iniciar_hls(cam.id, url)

            sector_id = cam.sector_id or 1
            task = asyncio.create_task(
                processar_stream_camera(cam.id, url, sector_id)
            )
            tarefas_deteccao[cam.id] = task
            logger.info(f"[STARTUP] Detecção real-time iniciada: câmera {cam.id}")

    except Exception as e:
        logger.error(f"[STARTUP] Erro: {e}", exc_info=True)

    try:
        while True:
            await asyncio.sleep(60)
    except asyncio.CancelledError:
        logger.info("[STARTUP] start_camera_streams encerrado.")


async def analyze_frame(camera_id: int, frame_data: bytes, sector_id: int | None = None) -> dict:
    """
    Analisa um frame avulso (endpoint /detection/analyze-frame).
    Se sector_id for informado, usa os EPIs obrigatórios do setor.
    """
    nparr = np.frombuffer(frame_data, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        return {
            "status": "erro", "detections": [], "epi_detected": [],
            "epis_ausentes": [], "epis_obrigatorios": [], "pessoa_detectada": False, "confidence": 0.0,
        }
    frame = _normalizar_frame(frame)
    deteccoes = inferir_frame(frame)

    if sector_id is not None:
        epis_obrigatorios = await buscar_epis_obrigatorios(sector_id)
    else:
        epis_obrigatorios = EPIS_OBRIGATORIOS_DEFAULT

    return avaliar_deteccoes(deteccoes, epis_obrigatorios)


async def analisar_frame(camera_id: int, frame: np.ndarray, sector_id: int | None = None) -> dict:
    frame = _normalizar_frame(frame)
    deteccoes = await asyncio.get_event_loop().run_in_executor(None, inferir_frame, frame)
    if sector_id is not None:
        epis_obrigatorios = await buscar_epis_obrigatorios(sector_id)
    else:
        epis_obrigatorios = EPIS_OBRIGATORIOS_DEFAULT
    return avaliar_deteccoes(deteccoes, epis_obrigatorios)
