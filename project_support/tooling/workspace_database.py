"""Explicit local database operations; secrets stay in an ACL-restricted config file."""
import argparse,json,os,subprocess
from pathlib import Path
from datetime import datetime,timezone
import psycopg
ROOT=Path(__file__).resolve().parents[2]
CONFIG=ROOT/'data/workspace/postgresql/connection.json'
BIN=ROOT/'project_support/tooling/postgresql/pgsql/bin'
def main():
 p=argparse.ArgumentParser();p.add_argument('action',choices=['status','backup','verify']);p.add_argument('--config',type=Path,default=CONFIG);a=p.parse_args()
 cfg=json.loads(a.config.read_text());conn={**cfg['admin'],'dbname':cfg['app']['dbname']}
 with psycopg.connect(**conn) as c:
  version=c.execute('SELECT version()').fetchone()[0]
  rows=c.execute('SELECT kind,revision FROM workspace_configuration ORDER BY kind').fetchall()
 if a.action=='status':print(json.dumps({'server':version,'definitions':rows}));return
 target=ROOT/'data/workspace/postgresql/backups'/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ');target.mkdir(parents=True,exist_ok=False)
 env={**os.environ,'PGPASSWORD':conn['password']}
 common=['-h',conn['host'],'-p',str(conn['port']),'-U',conn['user']]
 subprocess.run([str(BIN/'pg_dump.exe'),*common,'-Fc','-f',str(target/'workspace.dump'),conn['dbname']],env=env,check=True,capture_output=True)
 subprocess.run([str(BIN/'pg_dumpall.exe'),*common,'--globals-only','-f',str(target/'roles.sql')],env=env,check=True,capture_output=True)
 (target/'manifest.json').write_text(json.dumps({'database':conn['dbname'],'server':version,'definitions':rows,'schema_version':1}))
 if a.action=='verify':
  with psycopg.connect(**conn) as c:
   expected=c.execute('SELECT workspace_id,kind,revision,value FROM workspace_configuration ORDER BY workspace_id,kind').fetchall()
   history=c.execute('SELECT workspace_id,kind,revision,value FROM workspace_configuration_history ORDER BY workspace_id,kind,revision').fetchall()
  testdb='isdc_restore_test_'+datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
  from psycopg import sql
  with psycopg.connect(**cfg['admin'],autocommit=True) as c:c.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(testdb)))
  try:
   subprocess.run([str(BIN/'pg_restore.exe'),*common,'--exit-on-error','--no-owner','-d',testdb,str(target/'workspace.dump')],env=env,check=True,capture_output=True)
   with psycopg.connect(**{**conn,'dbname':testdb}) as c:
    restored=c.execute('SELECT workspace_id,kind,revision,value FROM workspace_configuration ORDER BY workspace_id,kind').fetchall()
    restored_history=c.execute('SELECT workspace_id,kind,revision,value FROM workspace_configuration_history ORDER BY workspace_id,kind,revision').fetchall()
   if restored!=expected or restored_history!=history:raise RuntimeError('restore contents mismatch')
   print('Backup and isolated restore verified')
  finally:
   with psycopg.connect(**cfg['admin'],autocommit=True) as c:c.execute(sql.SQL('DROP DATABASE {}').format(sql.Identifier(testdb)))
 print('Backup path:',target)
if __name__=='__main__':main()
