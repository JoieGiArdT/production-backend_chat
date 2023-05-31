import Routes from './routes/index.routes'
import cors from 'cors'
// import * as dialogflow from "@google-cloud/dialogflow";
/* import * as morgan from 'morgan';
import * as fs from 'fs';
import { WriteStream } from 'fs';
import * as path from 'path'; */
import * as winston from 'winston'
import { json, urlencoded } from 'express'

// app.enable('trust proxy'); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
export default class Server {
  constructor (app: any) {
    this.config(app)
    // eslint-disable-next-line no-new
    new Routes(app)
  }

  public config (app: any): void {
    /* const accessLogStream: WriteStream = fs.createWriteStream(
      path.join(__dirname, './logs/access.log'),
      { flags: 'a' }
    ); */
    // app.use(morgan('combined', { stream: accessLogStream }));
    app.use(json())
    app.use(urlencoded({ extended: false }))
    app.use(cors({
      origin: '*'
    }))
    // app.use(json())
  }
}

process.on('beforeExit', function (err) {
  winston.error(JSON.stringify(err))
  console.error(err)
})
