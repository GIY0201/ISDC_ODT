"""Explicit local development factory; never used by the normal product factory.
Set ISDC_DEV_RESUME_PATH to a captured public-state file before starting this factory.
"""
import json,os
from pathlib import Path
from user_application.web.application import create_stored_orbit_app

def create_app():
 path=Path(os.environ['ISDC_DEV_RESUME_PATH']).resolve()
 root=Path(__file__).resolve().parents[2]
 if not path.is_relative_to(root/'data'/'workspace'/'validation'):raise ValueError('resume capture must belong to project validation workspace')
 value=json.loads(path.read_text(encoding='utf-8'));app=create_stored_orbit_app()
 app.state.runtime.resume_unconfigured_development(value)
 return app
