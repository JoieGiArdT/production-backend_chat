import * as dotenv from 'dotenv'
import express from 'express'
import Server from './src/app'

dotenv.config()

const app = express()
// eslint-disable-next-line no-new
new Server(app)
const port: number = (process.env.PORT != null) ? parseInt(process.env.PORT, 10) : 80
const ip: string = (process.env.IP != null) ? process.env.IP : 'localhost'

app
  .listen(port, ip, function () {
    console.info(`Server running on : http://${ip}:${port}`)
  })
  .on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log('Server startup error: address already in use')
    } else {
      console.log(err)
    }
  })
