#!/usr/bin/env node
'use strict'

const fs = require('mz/fs')
const mkdirp = require('mkdirp')
const request = require('request-promise')
const inquirer = require('inquirer')
const path = require('path')
const minimist = require('minimist')

const pretty = (obj) => JSON.stringify(obj, null, '  ')

const loadKintoneCommands = async () => {
  const file = await fs.readFile(path.join(__dirname, 'commands.conf'), 'utf8')
  return file.replace(/\n+$/, '').split('\n')
}

const loadGinuerc = async () => {
  const file = await fs.readFile('./.ginuerc.json', 'utf8')
  const obj = JSON.parse(file)
  return obj
}

const createDirPath = (appId) => {
  return `${appId}`
}

const createFilePath = (ktn) => {
  const dirPath = createDirPath(ktn.appId)
  const fileName = `${ktn.command.replace(/\//g, '_')}`
  return `${dirPath}/${fileName}`
}

const createUrl = (ktn) => {
  return `https://${ktn.subDomain}.cybozu.com/k/v1/${ktn.command}?app=${ktn.appId}`
}

const createHeaders = (ktn) => {
  return {
    'X-Cybozu-Authorization': ktn.base64Account
  }
}

const fetchKintoneInfo = async (ktn) => {
  const options = {
    url: createUrl(ktn),
    headers: createHeaders(ktn),
    json: true,
  }
  return request(options)
}

const inputKintoneAccount = async (name, type) => {
  const value = await inquirer.prompt([{
    name,
    type,
    message: `Enter your kintone ${name}:`,
    validate: (value) => {
      if (value.length) {
        return true
      } else {
        return `Please enter your ${name}`
      }
    }
  }])
  return value
}

const createBase64Account = async (username, password) => {
  if (!username) {
    ({ username } = await inputKintoneAccount('username', 'input'))
  }
  if (!password) {
    ({ password } = await inputKintoneAccount('password', 'password'))
  }
  const base64Account = Buffer.from(`${username}:${password}`).toString('base64')
  return base64Account
}

const parseArgumentOptions = (opts) => {
  const argv = minimist(process.argv.slice(2), {
    string: [
      'domain',
      'app',
      'username',
      'password',
    ],
    alias: {
      d: 'domain',
      a: 'app',
      u: 'username',
      p: 'password',
    }
  })

  // TODO: もっとスマートに書けないものか・・・
  if (argv._[0]) { opts.type = argv._[0] }
  if (argv.domain) { opts.subDomain = argv.domain }
  if (argv.app) { opts.appId = argv.app }
  if (argv.username) { opts.username = argv.username }
  if (argv.password) { opts.password = argv.password }

  return opts
}

(async () => {
  const opts = await loadGinuerc()
  const {
    type,
    subDomain,
    appId,
    username,
    password,
  } = parseArgumentOptions(opts)
  console.log(opts)
  console.log({
    type,
    subDomain,
    appId,
    username,
    password,
  })

  if (type !== 'pull') {
    console.error('ERROR: Invalid argument!')
    process.exit(1)
  }

  const base64Account = await createBase64Account(username, password)

  mkdirp.sync(createDirPath(appId))

  const kintoneCommands = await loadKintoneCommands()
  kintoneCommands.forEach(async (command) => {
    const ktn = {
      subDomain,
      appId,
      base64Account,
      command,
    }
    try {
      const kintoneInfo = await fetchKintoneInfo(ktn)
      const filePath = createFilePath(ktn)
      console.log(filePath)
      fs.writeFile(filePath, pretty(kintoneInfo))
    } catch (error) {
      console.error(error)
    }
  })
})()
