
class BotUtil {
  getParameterForAnswerTask (
    paramaters: any,
    typeTask: string
  ): any {
    let callback
    switch (typeTask) {
      case 'Fotos': {
        callback = this.uploadImagesBot
        break
      }
      case 'Ayuda': {
        callback = this.createTicketBot
        break
      }
      default:
        return {}
    }
    return {
      ...callback(paramaters)
    }
  }

  createTicketBot (
    parameters: {
      answer: number
      response: any
    }
  ): any {
    switch (parameters.answer) {
      case 1:{
        return {
          parameters: {
            buttonName: 'Tipo',
            bodyText: 'Seleccione el departamento destino:',
            sections: {
              tipo: [{
                id: 'DESO',
                title: 'Desocupacion',
                description: 'Seleccione esta opcion...'
              }]
            },
            options: {
              header: {
                type: 'text',
                text: 'Financar Sas'
              }
            }
          },
          type: 'interactive',
          response_type: 'wp',
          status: 'PENDING',
          validation: 'approved'
        }
      }
      case 2:{
        let booleano = false
        Object.entries(parameters.response).forEach(([key, _value]) => {
          if (key === 'interactive') {
            booleano = true
          }
        }
        )
        if (booleano) {
          return {
            parameters: {
              text: 'Describa su solicitud:',
              options: {
                preview_url: false
              }
            },
            type: 'text',
            response_type: 'wp',
            status: 'PENDING',
            validation: 'approved',
            content: 'Desocupacion'
          }
        } else {
          return {
            parameters: {
              text: 'Tickets - Porfavor seleccione un departamento.',
              options: {
                preview_url: false
              }
            },
            type: 'text',
            response_type: 'wp',
            status: 'PENDING',
            validation: 'denied'
          }
        }
      }
      case 3:{
        let booleano = false
        Object.entries(parameters.response).forEach(([key, _value]) => {
          if (key === 'text') {
            booleano = true
          }
        }
        )
        if (booleano) {
          return {
            parameters: {
              text: 'Su caso fue enviado al area seleccionada.',
              options: {
                preview_url: false
              }
            },
            type: 'text',
            response_type: 'nx',
            status: 'DONE',
            validation: 'approved',
            content: parameters.response.text.body
          }
        } else {
          return {
            parameters: {
              text: 'Tickets - Porfavor simplemten escriba un parrafo donde describa su solicitud.',
              options: {
                preview_url: false
              }
            },
            type: 'text',
            response_type: 'wp',
            status: 'PENDING',
            validation: 'denied'
          }
        }
      }
    }
  }

  uploadImagesBot (
    parameters: {
      answer: number
      response: any
    }
  ): any {
    switch (parameters.answer) {
      case 1:{
        return {
          parameters: {
            buttonName: 'Tipo',
            bodyText: '🧝‍♂️Como primer paso, cuentame que tipo de inventario subiras📤:',
            sections: {
              tipo: [{
                id: 'OCU',
                title: 'Ocupacion',
                description: 'Seleccione esta opcion cuando...'
              },
              {
                id: 'DES',
                title: 'Desocupacion',
                description: 'Seleccione esta opcion cuando...'
              }]
            },
            options: {
              header: {
                type: 'text',
                text: 'Financar Sas'
              }
            }
          },
          type: 'interactive',
          response_type: 'wp',
          status: 'PENDING',
          validation: 'approved'
        }
      }
      case 2:{
        let booleano = false
        Object.entries(parameters.response).forEach(([key, _value]) => {
          if (key === 'interactive') {
            booleano = true
          }
        }
        )
        if (booleano) {
          return {
            parameters: {
              text: '🧝‍♂️Excelente!!, ahora como ultimo dato solo necesito que me compartas el codigo del Inmueble🏠 al cual quieres subirle un inventario.',
              options: {
                preview_url: false
              }
            },
            type: 'text',
            response_type: 'wp',
            status: 'PENDING',
            validation: 'approved',
            content: 'Desocupacion'
          }
        } else {
          return {
            parameters: {
              text: 'Subir imagenes - Porfavor seleccione un tipo de subida.',
              options: {
                preview_url: false
              }
            },
            type: 'text',
            response_type: 'wp',
            status: 'PENDING',
            validation: 'denied'
          }
        }
      }
      case 3:{
        let booleano = false
        Object.entries(parameters.response).forEach(([key, value]) => {
          const isNumeric = (n: any): boolean => !isNaN(n)
          const objeto = value as any
          if (key === 'text' && isNumeric(objeto.body)) {
            booleano = true
          }
        }
        )
        if (booleano) {
          return {
            parameters: {
              text: 'Increible!!, ya esta todo listo. Ahora las imagenes📷 subidas a continuacion seran montadas al inmueble🏠 especificado.',
              options: {
                preview_url: false
              }
            },
            type: 'text',
            response_type: 'wp',
            status: 'DONE',
            validation: 'approved',
            content: parameters.response.text.body
          }
        } else {
          return {
            parameters: {
              text: 'Subir imagenes - Porfavor ingrese un codigo de inmueble.',
              options: {
                preview_url: false
              }
            },
            type: 'text',
            response_type: 'wp',
            status: 'PENDING',
            validation: 'denied'
          }
        }
      }
      case 4:{
        let booleano = true
        Object.entries(parameters.response).forEach(([key, value]) => {
          if (key === 'image' && value !== null) {
            booleano = false
          }
        }
        )
        if (booleano) {
          return {
            parameters: {
              text: 'Las imagenes subidas a continuacion seran montadas al inmueble especificado anteriormente.',
              options: {
                preview_url: false
              }
            },
            type: 'text',
            response_type: 'wp',
            status: 'DONE'
          }
        } else {
          return {
            id_image: parameters.response.image.id,
            response_type: 'nx'
          }
        }
      }
    }
  }
}
const botUtil = new BotUtil()
export { botUtil }
