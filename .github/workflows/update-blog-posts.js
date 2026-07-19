// Fetch johnnyhuy.com/feed.xml and replace the BLOG-POST-LIST block in README.md
// with up to 5 latest posts. Pure Node, no dependencies.
'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')

const FEED_URL = 'https://johnnyhuy.com/feed.xml'
const README_PATH = path.resolve(__dirname, '..', '..', 'README.md')
const MAX_POSTS = 5
const START_MARKER = '<!-- BLOG-POST-LIST:START -->'
const END_MARKER = '<!-- BLOG-POST-LIST:END -->'

const decode = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x2F;/g, '/')
    .trim()

const fetchLatest = async () => {
  const res = await fetch(FEED_URL, { headers: { 'user-agent': 'johnnyhuy-profile-readme' } })
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`)
  const xml = await res.text()
  const itemBlocks = [...xml.matchAll(/<item>[\s\S]*?<\/item>/g)].slice(0, MAX_POSTS)
  return itemBlocks.map((m) => {
    const block = m[0]
    const title = decode((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '')
    const link = decode((block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '')
    return { title, link }
  }).filter((p) => p.title && p.link)
}

const render = (posts) =>
  posts.map((p) => `- [${p.title}](${p.link})`).join('\n')

const updateReadme = async (markdown, posts) => {
  const block = render(posts)
  const pattern = new RegExp(
    `(${escapeRegex(START_MARKER)})[^\\n]*\\n[\\s\\S]*?(${escapeRegex(END_MARKER)})`
  )
  if (!pattern.test(markdown)) throw new Error('BLOG-POST-LIST markers not found in README.md')
  return markdown.replace(pattern, `$1\n${block}\n$2`)
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

async function main() {
  const posts = await fetchLatest()
  if (posts.length === 0) {
    console.log('No posts found in feed; leaving README unchanged.')
    return
  }
  const original = await fs.readFile(README_PATH, 'utf8')
  const updated = await updateReadme(original, posts)
  if (updated === original) {
    console.log('README is already up to date.')
    return
  }
  await fs.writeFile(README_PATH, updated)
  console.log(`Wrote ${posts.length} posts to README.md`)
}

main().catch((err) => {
  console.error(err.stack || err.message)
  process.exit(1)
})