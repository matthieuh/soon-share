const path = require('path')
const { send } = require('micro')
const isMobile = require('ismobilejs')
const pug = require('pug')

const APP_URL_SCHEME = 'soon'
const APP_STORE_LINK = 'https://itunes.apple.com/app/id939751975'

module.exports = (req, res) => {
  const { url } = req
  console.log('url', url)

  let redirectionUrl
  if (url.includes('list')) {
    redirectionUrl = url.replace('list', 'shared-list')
  }

  const isIphone = isMobile(req.headers['user-agent']).apple.phone

  if (isIphone) {
    const template = path.join(__dirname, 'tmpl', 'redirect.pug')
    const compiledFunction = pug.compileFile(template)
    const html = compiledFunction({
      appLink: `${APP_URL_SCHEME}://${redirectionUrl}`,
      appStoreLink: APP_STORE_LINK
    })
    res.end(html)
  } else {
    const template = path.join(__dirname, 'tmpl', 'no-app.pug')
    const compiledFunction = pug.compileFile(template)
    const html = compiledFunction({})

    res.end(html)
  }
}
