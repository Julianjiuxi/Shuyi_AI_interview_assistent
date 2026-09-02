# API examples

## 1. Create project

```bash
curl -X POST http://127.0.0.1:8000/api/projects \
  -H 'Content-Type: application/json' \
  -d '{"subject_name":"Demo User"}'
```

## 2. Submit one interview answer

Replace IDs with the values returned above.

```bash
curl -X POST http://127.0.0.1:8000/api/interview/turn \
  -H 'Content-Type: application/json' \
  -d '{
    "project_id":1,
    "session_id":1,
    "answer":"I grew up in Shandong. When I was about seventeen, I left home for Shanghai for the first time. My father took me to the station, and I remember being nervous."
  }'
```

## 3. Generate a chapter

```bash
curl -X POST http://127.0.0.1:8000/api/chapters \
  -H 'Content-Type: application/json' \
  -d '{
    "project_id":1,
    "focus":"Write a short chapter about leaving home and entering adulthood."
  }'
```
