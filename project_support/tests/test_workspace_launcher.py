import os
import shutil
import subprocess
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[2]
@pytest.mark.skipif(os.name != "nt", reason="Windows launcher")
@pytest.mark.parametrize("mode,started,success", [("stopped",True,True),("running",False,True),("foreign",False,False),("db_down",False,False)])
def test_launcher_starts_only_absent_server_and_validates_identity(tmp_path,mode,started,success):
    source=ROOT/"project_support/tooling/open_workspace_app.ps1"
    shutil.copyfile(source,tmp_path/source.name)
    (tmp_path/"start_workspace_app.ps1").write_text("Set-Content -LiteralPath (Join-Path $PSScriptRoot 'started') -Value yes",encoding="utf-8")
    driver=tmp_path/"driver.ps1"
    driver.write_text(f"""function Get-NetTCPConnection {{ if ('{mode}' -ne 'stopped') {{ return @{{OwningProcess=123}} }} }}
function Invoke-RestMethod {{ param($Uri,$TimeoutSec)
 if ('{mode}' -eq 'foreign') {{ return @{{status='ok';name='Other App'}} }}
 if ($Uri -like '*/ground_stations') {{ if ('{mode}' -eq 'db_down') {{ throw 'database unavailable' }}; return @{{kind='ground_stations';revision=1}} }}
 if ($Uri -like '*/status') {{ return @{{enabled=$true;provider='postgresql'}} }}
 return @{{status='ok';name='SpaceTwin VVP'}}
}}
& (Join-Path $PSScriptRoot 'open_workspace_app.ps1') -StartupTimeoutSeconds 2
""",encoding="utf-8")
    result=subprocess.run(["powershell.exe","-NoProfile","-ExecutionPolicy","Bypass","-File",str(driver)],capture_output=True,text=True,timeout=10)
    assert (result.returncode==0)==success,result.stdout+result.stderr
    assert (tmp_path/"started").exists()==started
