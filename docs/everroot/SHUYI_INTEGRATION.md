# Everroot + ShuYi 2 integration

Aligned against `/Users/ryanho/Desktop/ShuYi 2` (FastAPI v0.2.0) on 2026-09-03.

## Frontend read path

Everroot should load the app in this order:

1. `GET /api/families/{family_id}/tree` — render people and connections.
2. On a person click, `GET /api/projects/{project_id}/archive?language=en&include_transcript=false` — render the timeline, story, letter and approved media.
3. Optionally `GET /api/projects/{project_id}/archive/status` — render processing/review state.
4. Use `GET /api/projects/{project_id}/memories?sort=chronological` only in an editor/review surface, not the public archive page.

The TypeScript contract and transformation are implemented in `lib/api-contracts.ts`.

## Frontend environment

```env
NEXT_PUBLIC_SHUYI_API_BASE_URL=http://127.0.0.1:8000
```

The current public Everroot deployment remains in demo mode. A browser cannot use its own `127.0.0.1` to reach another person's ShuYi server. For shared deployment, ShuYi needs a reachable HTTPS URL or Everroot needs a server-side proxy/tunnel.

## Confirmed ShuYi 2 endpoints

- Projects, sessions and interview turns
- Families, family tree and relationships
- Memory listing, editing, confirmation, rejection and bulk review
- Document generation, listing, editing, approval and soft deletion
- Archive, archive status and usage summary
- Image, audio and video jobs
- Media job query, cancel and retry
- Media asset listing, editing and deletion
- File upload

## Blocking issues before real MiniMax use

### 1. H3 endpoint and payload are outdated

`app/services/minimax_client.py` currently uses:

```text
POST /v1/video_generation
GET  /v1/query/video_generation
```

and sends `prompt` plus `first_frame_image`. MiniMax H3 currently uses:

```text
POST /v2/video_generation
GET  /v2/query/video_generation/{task_id}
```

with a multimodal `content[]` payload. A first frame is represented by an `image_url` content item with `role: "first_frame"`.

### 2. Image API is treated as asynchronous

MiniMax `image-01` commonly returns image data directly from `/v1/image_generation`. The worker must parse and store the returned image rather than assuming every modality returns a task id.

### 3. Speech response handling must be verified

`speech-2.8-hd` uses `/v1/t2a_v2`, but the worker must decode or download the actual audio field returned by MiniMax and save it as a `MediaAsset`.

### 4. Uploaded files are created with `project_id=0`

`POST /api/files` creates `MediaAsset(project_id=0)` and provides no binding endpoint. Add `project_id` as a multipart form field or add `POST /api/projects/{project_id}/files`.

### 5. Archive language is not actually applied

`GET /archive?language=en` accepts `language`, but `ArchiveService` selects the latest published document without filtering `Document.language`. It should prefer the requested language.

### 6. Published content requirement

The archive only returns `featured_story` and `family_letter` when document status is exactly `published`. Approving a document produces `approved`; the client must separately publish it or the backend should provide an explicit publish endpoint.

## Demo-safe integration sequence

1. Run ShuYi 2 with `ENABLE_MOCK_MEDIA=true`.
2. Seed a family, members and relationships.
3. Confirm memories.
4. Generate and publish English documents.
5. Add approved local media assets.
6. Verify `/tree` and `/archive` responses.
7. Connect Everroot locally.
8. Only after this passes, configure `MINIMAX_API_KEY` and repair the real media worker/client.
