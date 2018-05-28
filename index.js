const path = require('path')
const { send } = require('micro')
const { router, get } = require('microrouter')
const isMobile = require('ismobilejs')
const pug = require('pug')
const axios = require('axios')
const qs = require('qs')
const _ = require('lodash')

require('dotenv').config()

const APP_URL_SCHEME = 'soon'
const APP_STORE_LINK = 'https://itunes.apple.com/app/id939751975'

const CONFIG = {
  collection: {
    mobileDeepLink: 'collection',
    fetchUrls: {
      collectionData: ({ collectionId }) => `/v1/collections/${collectionId}`
    },
    fetchDataMapper: {
      title: 'collectionData.collection.title',
      description: 'collectionData.collection.description',
      mainCover: 'collectionData.collection.image_url',
      items: 'collectionData.collection.items',
      authorReplacer: 'collectionData.collection.subtitle'
    },
  },
  userCategory: {
    mobileDeepLink: 'shared-list',
    fetchUrls: {
      categoryData: ({ userId, userCategoryId }) => `/v2/users/${userId}/categories/${userCategoryId}/items`,
      userData: ({ userId }) => `/v1/users/${userId}`
    },
    fetchDataMapper: {
      items: 'categoryData.user_items',
      avatar: 'userData.user.avatar_url',
      user: 'userData.user'
    },
  },
  user: {
    mobileDeepLink: 'user',
    fetchUrls: {
      userData: ({ userId }) => `/v2/users/social-profile/${userId}`
    },
    fetchDataMapper: {
      avatar: 'userData.user.avatar_url',
      user: 'userData.user'
    },
  }
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

const listSharing = ({ type: listType }) => async (req, res) => {
  const { url, params: {
    type: typeParam,
    ...restParams
  } } = req

  const type = listType || typeParam;

  console.log('type', type)

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

  const { data: authData } = await instance
    .post(process.env.API_AUTHENTICATION_PATH, params)
    .catch(error => {
      console.log('error getting auth', error)
    })
  console.log('authData', authData)
  instance.defaults.headers.common['Authorization'] = `Bearer ${authData.access_token}`

  if (!CONFIG[type]) {
    render(res, '404', {}, 404)
  }

  const CONF = CONFIG[type]

  redirectionUrl = url.replace(type, CONF.mobileDeepLink)

  const fetchUrls = _.get(CONF, 'fetchUrls', {})
  const data = await Object.entries(fetchUrls)
    .reduce(async (previousPromise, [key, fetchUrlBuilder]) => {
        const acc = await previousPromise;
        const fetchRes = await instance.get(fetchUrlBuilder(restParams)).catch(error => render(res, '404', {}, 404));
        acc[key] = fetchRes.data
        return acc
      }, Promise.resolve({}))

  console.log('data', data)

  const isIphone = isMobile(req.headers['user-agent']).apple.phone

  if (isIphone) {
    return render(res, 'redirect', {
      appLink: `${APP_URL_SCHEME}://${redirectionUrl}`,
      appStoreLink: APP_STORE_LINK
    })
  }

  const dataMapper = _.get(CONF, 'fetchDataMapper', {});
  const variables = Object.entries(dataMapper)
    .reduce((acc, [key, mapper]) => {
      acc[key] = _.get(data, mapper)
      return acc
    }, {})

  variables.items = _.get(variables, 'items', [])
    .map(item => {
        const cover = _.find(item.api_item.attributes, { name: 'cover' })
        const thumb = _.find(item.api_item.attributes, { name: 'thumbnail' })
        return {
          name: _.get(item, 'api_item.name'),
          cover: _.get(thumb, 'content') || _.get(cover, 'content'),
        }
      })

  return render(res, 'no-app', variables)
}


const notFound = (req, res) => render(res, '404', {}, 404)

module.exports = router(
  get('/collection/:collectionId', listSharing({ type: 'collection' })),
  get('/user/:userId/category/:userCategoryId', listSharing({ type: 'userCategory' })),
  get('/c/:userCategoryHash', listSharing({ type: 'userCategory', hash: true })),
  get('/user/:userId', listSharing({ type: 'user' })),
  get('/*', notFound)
)
