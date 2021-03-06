import {Auth} from './auth'
import {YamlConfig, Entry, AwsClientConfig, FumeEnvironment, S3Config} from './types'
import execa from 'execa'

export default class Deployment {
  auth: Auth

  config: YamlConfig

  entry!: Entry

  s3!: S3Config

  constructor(config: YamlConfig, env: FumeEnvironment) {
    this.auth = new Auth(env)
    this.config = config
  }

  async initialize(environment: string) {
    let commit: string
    try {
      commit = (await execa('git', ['log',  '--decorate=short',  '-n 1'])).stdout
    } catch (error) {
      throw new Error('This project has no commits, please add one before deploying')
    }

    const data = {
      env: environment,
      commit: commit,
    }

    this.entry = (await this.auth.axios.post(`/project/${this.config.id}/dep`, data)).data.data.data
    this.s3 = (await this.auth.axios.get(`/project/${this.config.id}/dep/${this.entry.id}/s3`)).data.data
    this.s3.path = `${__dirname}/${this.s3.file}`
    return this.entry
  }

  async update(status: string) {
    try {
      return this.auth.axios.put(`/project/${this.config.id}/dep/${this.entry.id}`, {status})
    } catch (error) {
      throw new Error(error.response)
    }
  }

  async sts(): Promise<AwsClientConfig> {
    try {
      const result = (await this.auth.axios.get(`/project/${this.config.id}/sts`)).data.data
      return {
        accessKeyId: result.AccessKeyId,
        secretAccessKey: result.SecretAccessKey,
        sessionToken: result.SessionToken,
        expiration: result.Expiration,
        region: this.entry.project.region,
      }
    } catch (error) {
      throw new Error(error.response)
    }
  }
}
