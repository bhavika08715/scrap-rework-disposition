#!/usr/bin/env bash
# End-to-end demo through the gateway. Run after: docker compose up -d --build
set -e
G=http://localhost:8080
login(){ curl -s $G/auth/login -H 'content-type: application/json' -d "{\"username\":\"$1\",\"password\":\"pass123\"}" | sed 's/.*"token":"\([^"]*\)".*/\1/'; }
call(){ curl -s -X "$1" "$G$2" -H "Authorization: Bearer $3" -H 'content-type: application/json' ${4:+-d "$4"}; echo; }
echo "== 1. No token => 401";            curl -s -o /dev/null -w "%{http_code}\n" $G/api/inspections
INS=$(login inspector1); ENG=$(login engineer1); MGR=$(login manager1)
echo "== 2. Inspector logs a scratch (cheap rework)"
call POST /api/inspections $INS '{"partNo":"P-100","defectType":"surface_scratch","severity":2,"unitValue":100,"quantity":10}'
echo "== 3. Inspector logs a cracked batch (high value scrap)"
call POST /api/inspections $INS '{"partNo":"P-200","defectType":"crack","severity":3,"unitValue":5000,"quantity":5}'
echo "== 4. Engineer evaluates both"
call POST /api/dispositions/evaluate $ENG '{"inspectionId":1}'
call POST /api/dispositions/evaluate $ENG '{"inspectionId":2}'
echo "== 5. Inspector tries to approve => 403"; call POST /api/dispositions/2/approve $INS
echo "== 6. Manager approves the scrap"; call POST /api/dispositions/2/approve $MGR
echo "== 7. All dispositions"; call GET /api/dispositions $MGR
