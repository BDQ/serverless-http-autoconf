import {httpMethodFromAction} from './configBuilder'

const inflection = require('inflection')
const path = require('path')
const fs = require('fs')

const basePath = (serverless) => {
  if ( ((serverless.service.custom || {}).autoConfig || {}).basePath) {
    return serverless.service.custom.autoConfig.basePath
  } else {
    return 'src/api'
  }

}

// another resursive function for building up (nested) routes
// and return path + parameter config for sls
// 
const buildPath = (resource, isCollection, pathConfig) => {
  if (!pathConfig){
    pathConfig = { path: '' }
  }

  //get first
  let sub = resource.splice(0, 1)[0].toLowerCase()
  let singular = inflection.singularize(sub)
  let plural = inflection.pluralize(sub)

  if (isCollection && resource.length === 0) {
    pathConfig.path += `/${plural}`
  } else {
    pathConfig.path += `/${plural}/{${singular}Id}`

    if (!pathConfig.request) {
      pathConfig.request = { parameters: { paths: {} } }
    }

    pathConfig.request.parameters.paths[`${singular}Id`] = true
  }

  if (resource.length === 0) {
    return pathConfig
  } else {
    return buildPath(resource, isCollection, pathConfig)
  }
}

// auto-generates the config for a single function
//
const buildConfig = (resource, action, base) => {
  let method = httpMethodFromAction(action)

  let config = {
    handler: `${base}/${resource.join('/')}/${action}.handler`
  }

  if (method) {
    let event = { http: {
      method,
      cors: true
    }}

    let pathConfig = {}
    if ((method === 'get' && action.toLowerCase() === 'list') || (method === 'post')){
      pathConfig = buildPath(resource, true)
      event.http = { ...event.http, ...pathConfig }
    } else {
      pathConfig = buildPath(resource, false)
      event.http = { ...event.http, ...pathConfig }
    }

    config.events = [event]
  }

  return config
}


// enumerates all the functions and auto-generates config including HTTP event if named correctly.
// oh and it's recursive - cause you know directories 
const enumerateHandlers = (dir, base, namePrefix, config = {}) => {
  // list directories + files in base dir
  const files = fs.readdirSync(dir).map(f => path.join(dir, f))

  files.forEach(f => {
    if (fs.statSync(f).isDirectory()) {
      // recurse - F**K F**K <- re-curse .... get it?
      enumerateHandlers(f, base, namePrefix, config)
    } else {

      // most of this is concerned with parse the files paths
      // and tweaking them into something that sls likes
      const parts = f.split(`/${base}/`)
      const relFile = parts[parts.length-1]
      const fileType = relFile.split('.').slice(-1)[0]

      // must be a js file ext
      // and not include .test or spec.
      if(relFile && fileType === 'js' && !['.test', 'spec.'].some ( ptn => relFile.includes(ptn) ) ) {
        // strips .js from filenames
        let fileParts = relFile.replace('.js', '').split('/')
        let resource = fileParts.slice(0, -1)//.join('/')
        let action = fileParts.slice(-1)[0]

        let functionConfig = buildConfig(resource, action, base)

        /// converts users/list.js => ListUsers
        fileParts = fileParts.map(f => f.charAt(0).toUpperCase() + f.slice(1 ) )
        let functionName = fileParts.reverse().join('')

        // build up the object with the function configs
        config[functionName] = functionConfig
  
        // I don't want to do this, but I can find the right serverless hook to
        // let serverless do the function naming for me
        //
        config[functionName].name = `${namePrefix}-${functionName}`
      }
    }
  })
  return config
}

// builds the serverless .functions object
//
const addFunctionsDefinitions = (serverless) => {
  console.log('adding auto functions')
  let namePrefix = `${serverless.service.service}-${serverless.service.provider.stage}`


  // TODO read the ./src/handlers string from config (with default)
  let base = basePath(serverless)
  let { servicePath } = serverless.config
  let functionsConfig = enumerateHandlers(`${servicePath}/${base}`, base, namePrefix)

  // console.log(JSON.stringify(functionsConfig, null, 2))

  serverless.service.functions = { ...functionsConfig, ...serverless.service.functions }

}

// called after webpack compile, this will attempt to require the functions
// and check if they have a `config` function - calling it and merging into the
// functions auto generated config.
//
const addFunctionCustomConfig= (serverless) => {
  let functions = serverless.service.functions

  console.log('adding custom config')
  for (let functionName in functions){
    let functionDefinition = functions[functionName]

    let { servicePath } = serverless.config

    try {
      let compiledPath = `./dist/service/${functionDefinition.handler.replace('.handler', '')}`
      console.log(compiledPath)
      // if (fs.existsSync(compiledPath)) {
        // console.log('file exists')
        let compiledCode = require(compiledPath)

        if (compiledCode.config) {
          Object.assign(functionDefinition, compiledCode.config())
        }
      // }
    } catch(err) {
      console.log(err.message)
    }
  }

}

class ServerlessHttpAutoConf {
  constructor (serverless, options) {
    this.hooks = {
      // for package / deploy / etc
      'after:package:cleanup': () => addFunctionsDefinitions(serverless),
      'before:package:createDeploymentArtifacts': () => addFunctionCustomConfig(serverless),
      // for offline (with start)
      'before:webpack:validate:validate': () => addFunctionsDefinitions(serverless),
      'before:offline:start:init': () => addFunctionCustomConfig(serverless),
      // for offline (without start)
      'before:offline:start': () => addFunctionCustomConfig(serverless)
    }
  }
}

module.exports = ServerlessHttpAutoConf