"""Deployment defaults for the first virtual-station feature."""
from pathlib import Path
# Source root is discovered locally, never an individual developer path.
ORBIT_INPUT_DIRECTORY=Path(__file__).resolve().parents[2]/'data'/'workspace'/'inputs'/'orbit'
JEJU_LATITUDE_DEG=33.4996
JEJU_LONGITUDE_DEG=126.5312
JEJU_ELLIPSOID_HEIGHT_M=0.0
MINIMUM_ELEVATION_DEG=10.0
MAX_VISIBILITY_HOURS=24
MAX_POSITION_SAMPLES=3601
CALCULATION_WORKERS=2
CALCULATION_WAITING_REQUESTS=2

ORBIT_MANIFEST_PATH=ORBIT_INPUT_DIRECTORY/'manifest.json'
