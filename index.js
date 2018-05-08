const path = require('path')
const { send } = require('micro')
const { router, get } = require('microrouter')
const isMobile = require('ismobilejs')
const pug = require('pug')
const axios = require('axios')
const qs = require('qs');
const _ = require('lodash');

require('dotenv').config()

const APP_URL_SCHEME = 'soon'
const APP_STORE_LINK = 'https://itunes.apple.com/app/id939751975'

function sleep(ms = 0) {
  return new Promise(r => setTimeout(r, ms));
}

const render = (res, filename, variables = {}, status = 200) => {
  const template = path.join(__dirname, 'tmpl', `${filename}.pug`)
  const compiledFunction = pug.compileFile(template)
  const html = compiledFunction(variables)
  send(res, status, html)
}

const createAuthHeader = token => ({
  Authorization: `Bearer ${token.accessToken}`
})

const listSharing = async (req, res) => {
  const { url, params: { id, type } } = req

  let redirectionUrl

  const instance = axios.create({
    baseURL: process.env.API_BASE_URL,
    timeout: 1000,
  })

  const params = {
    client_id: process.env.OAUTH_CLIENT_ID,
    client_secret: process.env.OAUTH_CLIENT_SECRET,
    grant_type: 'password',
    username: process.env.USERNAME,
    password: process.env.PASSWORD,
  }

  const { data: authData } = await instance.post(process.env.API_AUTHENTICATION_PATH, params)
    .catch(error => {
      console.log('error getting auth', error);
    });
  console.log('authData', authData)
  instance.defaults.headers.common['Authorization'] = `Bearer ${authData.access_token}`;
  await sleep(500)

  switch (type) {
    case 'list':
      redirectionUrl = url.replace('lists', 'shared-list')
      break;
    case 'collections':
      redirectionUrl = url
      break;
    default:
      render(res, '404', {}, 404)
  }

  const collectionRes = await instance.get(`/collections/${id}`)
    .catch(error => {
      console.log('error getting collection', error);
    });
  const { data: { collection: data } } = collectionRes
  console.log('data', data.items[0], data.items[0].api_item.attributes)

  const isIphone = isMobile(req.headers['user-agent']).apple.phone

  if (isIphone) {
    render(res, 'redirect', {
      appLink: `${APP_URL_SCHEME}://${redirectionUrl}`,
      appStoreLink: APP_STORE_LINK
    })
  } else {
    render(res, 'no-app', {
      type,
      title: _.get(data, 'title'),
      items: data.items.map(item => {
        const cover = _.find(item.api_item.attributes, { name: 'cover' })
        return {
          name: _.get(item, 'api_item.name'),
          cover: cover.content,
        }
      }),
    })
  }
}

module.exports = router(
  get('/:type/:id', listSharing),
)
