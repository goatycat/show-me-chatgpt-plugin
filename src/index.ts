import { OpenAPIRouter } from '@cloudflare/itty-router-openapi'
import { KVNamespace, ExecutionContext } from '@cloudflare/workers-types'
import { defineAIPluginManifest } from 'chatgpt-plugin'
import { createCors } from 'itty-cors'

import pkg from '../package.json'
import { MermaidRoute, RenderRoute } from './routes/Mermaid'
import { ShortLinkRoute, debugCreateLink } from './routes/Shorten'

export interface Env {
  SHORTEN: KVNamespace
  CHAT_HISTORY: KVNamespace
}

const router = OpenAPIRouter({
  schema: {
    info: {
      title: "Show Me",
      version: pkg.version
    }
  }
})

const { preflight, corsify } = createCors({ origins: ['*'] })
router.all('*', preflight)

// 2. Expose magic openapi.json, expose API itself
router.get('/', MermaidRoute)

router.get('/render', RenderRoute)

router.post('/debug/links', debugCreateLink)
router.get('/s/:id', ShortLinkRoute)

// 1. Define the plugin manifest
router.get('/.well-known/ai-plugin.json', (request: Request) => {
  const url = new URL(request.url)
  const host = request.headers.get('host')
  const openAPIUrl = `${url.protocol}//${host}/openapi.json`

  const pluginManifest = defineAIPluginManifest(
    {
      description_for_human:
        'Render any Diagram using Mermaid, GraphViz, and many more.',
      name_for_human: 'Show Me',
      logo_url:
        'https://res.cloudinary.com/deepwave-org/image/upload/v1681620862/Heye.earth/Projects/PinClipart.com_venn-diagram-clipart_5480153_hk80cf.png',
      contact_email: 'kirill2003de@gmail.com',
      legal_info_url: 'https://example.com',
      description_for_model: DESCRIPTION_FOR_MODEL
    },
    { openAPIUrl }
  )

  return new Response(JSON.stringify(pluginManifest, null, 2), {
    headers: {
      'content-type': 'application/json;charset=UTF-8'
    }
  })
})

// 404 for everything else
router.all('*', () => new Response('404 Not Found...', { status: 200 }))

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': request.headers.get(
            'Access-Control-Request-Headers'
          )
        }
      })
    }
    return router.handle(request, env, ctx).then(corsify)
  }
}

const DESCRIPTION_FOR_MODEL = `You should use this plugin when people want visualizations. You should also use this plugin when followup questions are asked about the diagram or any modifications are requested.
Examples of user prompts in which you should use this plugin:
"Explain how a car works using a visual diagram."
"Describe the process of making a car."
"How does a car engine work?"

Use this plugin if a user asks about: how something works, explain about a concept or how something is made, summarize a book, describe a process, and other user prompts that can be summarized or explained in the format of a mindmap or a state diagram. Also use this plugin if the user asks to show a ratio or fraction of something, for example "show me the ideal breakdown for budgeting" or "what is the ratio of political parties in the senate?". Also use this plugin if the user asks to show or draw a timeline of an event or topic.

Also use this plugin if 

How to create a request to the plugin API:
You create the diagram in mermaid syntax based on what user asked and pass it to the plugin API to render.

You want to stick to using graph TB types of diagrams unless user specifically asks for a differnt type of diagram.

Examples.

User asks: "Show me how vscode internals work."
Your call to the api:
{
  query: 
  "graph TB
    User-->FileOperations{File Operations}
    User-->CodeEditor{Code Editor}
    FileOperations-->|Manipulation of Files| FileSystem
    FileSystem-->|Write/Read|Disk
    FileSystem-->|Compress/Decompress|ZipLib
    FileSystem-->|Read|INIParser
    CodeEditor-->|Create/Display/Edit| Webview
    CodeEditor-->|Language/Code Analysis| VSCodeAPI
    VSCodeAPI-->ValidationEngine
    Webview-->|Render UI| HTMLCSS
    ValidationEngine-->ErrorDecoration
    ValidationEngine-->TextDocument
  "
}

User asks:
"Computing backend data services is a distributed system made of multiple microservices.

A web browser sends an HTTP api request to the load balancer.
The load balancer sends the http request to the crossover service.
Crossover talks to redis and mysql database.
Crossover makes a downstream API request to multiplex to submit the query which returns a job id to crossover.
Then crossover makes a long poll API request to evaluator to get the results of the job.
Then evaluator makes an API call to multiplex to check the status of the job.
Once evaluator gets a successful status response from multiplex, then evaluator makes a third API call to result-fetcher service to download the job results from S3 or GCP cloud buckets.
The result is streamed back through evaluator to crossover.

Crossover post processes the result and returns the API response to the client.

Draw me a diagram of this system"

Your call to the api:
{
  query:
  "graph TB
    A["Web Browser"] -- HTTP API Request --> B["Load Balancer"]
    B -- HTTP Request --> C["Crossover"]
    C -- Talks to --> D["Redis"]
    C -- Talks to --> E["MySQL"]
    C -- Downstream API Request --> F["Multiplex"]
    F -- Returns Job ID --> C
    C -- Long Poll API Request --> G["Evaluator"]
    G -- API Call --> F
    G -- API Call --> H["Result-Fetcher"]
    H -- Downloads Results --> I["S3 or GCP Cloud Buckets"]
    I -- Results Stream --> G
    G -- Results Stream --> C
    C -- API Response --> A
  "
}

Sometimes you will need to revise the same diagram based on user feedback.
For the last example the user might make a followup request:

User followup ask:
"Crossover post processes the result and returns the API response to the client through the load balancer.

Draw the crossover node in green"

Your call to the api:
{
  query:
  "graph TB
    A["Web Browser"] -- HTTP API Request --> B["Load Balancer"]
    B -- HTTP Request --> C["Crossover"]
    style C fill:#99cc99
    C -- Talks to --> D["Redis"]
    C -- Talks to --> E["MySQL"]
    C -- Downstream API Request --> F["Multiplex"]
    F -- Returns Job ID --> C
    C -- Long Poll API Request --> G["Evaluator"]
    G -- API Call --> F
    G -- API Call --> H["Result-Fetcher"]
    H -- Downloads Results --> I["S3 or GCP Cloud Buckets"]
    I -- Results Stream --> G
    G -- Results Stream --> C
    C -- API Response --> B
    B -- API Response --> A
  "
}

Interpreting the API response:
When you get the response it will include an image url, you should render it inline using ![alt text](image) syntax.
You will also get a link as editDiagramOnline to edit the diagram, you should render it inline using [link text](url) syntax.
Include the links only once, do not repeat the same link.
`;