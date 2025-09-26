```txt
npm install
npm run dev
```

```txt
npm run deploy
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```

## API Notes

### Create a call record

```
POST /calls
```

Requires authentication. Expects `user_id`, `agent_name`, `started_at`, `ended_at`, and `messages_json` fields.

### Update call summary

```
PUT /calls/:call_id/summary
```

**Body**

```json
{
	"summary": "Short description of the call"
}
```

Requires authentication. Returns the updated call record when successful.
