import type { IncomingMessage, ServerResponse } from 'node:http'

import { handleVercelNodeRequest } from '../../server/src/vercelApp.js'

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleVercelNodeRequest(req, res)
}
