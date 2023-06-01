import axios from 'axios'

class NinoxService {
  private readonly apiKey = 'a299d930-fd86-11ed-8094-d9a7089de314'
  private readonly teamId = '5oGBqxntF33ZG2i2R'
  private readonly databaseId = 'hm78r8k8dy4s'

  async searchPersonByIdentification (identification: string): Promise<boolean> {
    const query = `select 'Personas' where 'Número Identificación' = "${identification}"`
    const recordIds = await this.getRecordIds(query)
    return recordIds.length > 0
  }

  async getInmuebleByAddress (address: string): Promise<boolean> {
    const query = `select 'Inmuebles' where 'Dirección' = "${address}"`
    const recordIds = await this.getRecordIds(query)
    return recordIds.length > 0
  }

  async checkPinMatch (identification: string, pin: string): Promise<boolean> {
    const query = `select 'Personas' where 'Número Identificación' = "${identification}" and Pin = "${pin}"`
    const recordIds = await this.getRecordIds(query)
    return recordIds.length > 0
  }

  async getContractDocumentByAddress (address: string): Promise<any> {
    const query = `select 'Contratos' where Inmueble.'Dirección' = "${address}" order by today() - FechaFinContrato`
    const recordIds = await this.getRecordIds(query)
    if (recordIds.length > 0) {
      const recordId = recordIds[0].replace(/^\D+/g, '')
      const document = await this.getRecordFile('Contratos', recordId, 'Contrato.pdf')
      return document
    } else {
      throw new Error('No se encontró ningún contrato para la dirección especificada.')
    }
  }

  async getAddressByIdentification (identification: string): Promise<any> {
    const query = `select 'Personas' where 'Número Identificación' = "${identification}"`
    const address = []
    const recordIds = await this.getRecordIds(query)
    if (recordIds.length > 0) {
      const recordId = recordIds[0].replace(/^\D+/g, '')
      const inmuebles = []
      const propietario = await this.getRecordValue('Personas', recordId, 'Propietario o tenedor de estos inmuebles')
      const contratos = await this.getRecordValue('Personas', recordId, 'Inquilino en estos contratos')
      if (propietario !== undefined) {
        for (let elemento of propietario) {
          elemento = String(elemento).replace(/^\D+/g, '')
          inmuebles.push(elemento)
        }
      }
      if (contratos !== undefined) {
        for (let elemento of contratos) {
          elemento = String(elemento).replace(/^\D+/g, '')
          const inmueble = await this.getRecordValue('Contratos', elemento, 'Inmueble')
          inmuebles.push(inmueble)
        }
      }
      for (const elemento of inmuebles) {
        const direccion = await this.getRecordValue('Inmuebles', elemento, 'Dirección')
        address.push({
          id: elemento,
          /* title: direccion.slice(0, 24), */
          title: direccion,
          description: ''
        })
      }
      return address
    } else {
      throw new Error('No se encontró ningún contrato para la dirección especificada.')
    }
  }

  async getInfoByAddress (address: string): Promise<any> {
    const info = {
      informacion_del_inmueble: null,
      informacion_del_contrato: null,
      informacion_del_inquilino: null,
      informacion_del_propietario: 'Sin acceso'
    }
    let query = `select 'Inmuebles' where 'Dirección' = "${address}"`
    let recordId = await this.getRecordIds(query)
    let id = String(recordId[0]).replace(/^\D+/g, '')
    let valores = await this.getRecordValueAll('Inmuebles', id)
    info.informacion_del_inmueble = valores
    query = `select 'Contratos' where Inmueble.'Dirección' = "${address}" order by today() - FechaFinContrato`
    recordId = await this.getRecordIds(query)
    id = String(recordId[0]).replace(/^\D+/g, '')
    valores = await this.getRecordValueAll('Contratos', id[0])
    info.informacion_del_contrato = valores
    valores = await this.getRecordValueAll('Personas', valores.Inquilino)
    info.informacion_del_inquilino = valores
    return info
  }

  async getServiceReferenceByAddress (address: string, service: string): Promise<string> {
    const query = `select 'Inmuebles' where 'Dirección' = "${address}"`
    const recordIds = await this.getRecordIds(query)
    if (recordIds.length > 0) {
      const recordId = recordIds[0].replace(/^\D+/g, '')
      let reference = ''
      switch (service) {
        case 'agua':
          reference = await this.getRecordValue('Inmuebles', recordId, 'Número de referencia Agua')
          break
        case 'energía':
          reference = await this.getRecordValue('Inmuebles', recordId, 'Número de referencia Energía')
          break
        case 'gas natural':
          reference = await this.getRecordValue('Inmuebles', recordId, 'Número de referencia Gas Natural')
          break
      }
      return reference
    } else {
      throw new Error('No se encontró ningún inmueble para la dirección especificada.')
    }
  }

  async getInventoryDocumentByAddress (address: string): Promise<any> {
    const query = `select 'TMP_Inventarios' where Inmueble.'Dirección' = "${address}" order by today() - 'Fecha Inventario Inicial'`
    const recordIds = await this.getRecordIds(query)
    if (recordIds.length > 0) {
      const recordId = recordIds[0].replace(/^\D+/g, '')
      const document = await this.getRecordFile('TMP_Inventarios', recordId, 'inventario.pdf')
      return document
    } else {
      throw new Error('No se encontró ningún inventario para la dirección especificada.')
    }
  }

  async getPersonInfoByAddress (address: string): Promise<object> {
    const query = `select 'Contratos' where Inmueble.'Dirección' = "${address}" order by today() - FechaFinContrato`
    const recordIds = await this.getRecordIds(query)
    if (recordIds.length > 0) {
      const recordId = recordIds[0].replace(/^\D+/g, '')
      let reference = ''
      reference = await this.getRecordValue('Contratos', recordId, 'Inquilino')
      const info = {
        nombre: await this.getRecordValue('Personas', reference, 'Nombre(s)'),
        Celular: await this.getRecordValue('Personas', reference, 'Celular'),
        Email: await this.getRecordValue('Personas', reference, 'Email')
      }
      return info
    } else {
      throw new Error('No se encontró ningún inmueble para la dirección especificada.')
    }
  }

  private async getRecordIds (query: string): Promise<string[]> {
    const url = `https://api.ninox.com/v1/teams/${this.teamId}/databases/${this.databaseId}/query?query=${encodeURIComponent(query)}`
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`
    }
    const response = await axios.get(url, { headers })
    return response.data
  }

  private async getRecordFile (tableName: string, recordId: string, fileName: string): Promise<any> {
    const url = `https://api.ninox.com/v1/teams/${this.teamId}/databases/${this.databaseId}/tables/${tableName}/records/${recordId}/files/${fileName}`
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`
    }
    const response = await axios.get(url, { headers, responseType: 'arraybuffer' })
    return response.data
  }

  private async getRecordValue (tableName: string, recordId: string, field: string): Promise<any> {
    const url = `https://api.ninox.com/v1/teams/${this.teamId}/databases/${this.databaseId}/tables/${tableName}/records/${recordId}`
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`
    }
    const response = await axios.get(url, { headers })
    return response.data.fields[field]
  }

  private async getRecordValueAll (tableName: string, recordId: string): Promise<any> {
    const url = `https://api.ninox.com/v1/teams/${this.teamId}/databases/${this.databaseId}/tables/${tableName}/records/${recordId}`
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`
    }
    const response = await axios.get(url, { headers })
    return response.data.fields
  }
}

/* async function testNinoxService () {
  try {
    const ninoxService = new NinoxService()
    const direccion = 'K 23 No. 64 - 122'
    const identificacion = '1001938954'
    const pin = '1214'

    const personExists = await ninoxService.searchPersonByIdentification(identificacion)
    console.log(`La persona con identificación ${identificacion} ${personExists ? 'existe' : 'no existe'}.`)

    const jeje = await ninoxService.getAddressByIdentification(identificacion)
    console.log(jeje)
    await whatsappService.sendMessageWhatsapp(
      {
        buttonName: 'Ver más direcciones',
        bodyText: 'Lista de direcciones:',
        sections: {
          Direcciones: jeje
        },
        options: {
          // Opciones adicionales, si es necesario
        }
      }
      ,
      'list',
      String(process.env.ID_NUMBER),
      String(process.env.WP_TOKEN),
      '3054449992'
    )

    const pinMatch = await ninoxService.checkPinMatch(identificacion, pin)
    console.log(`El PIN ${pin} ${pinMatch ? 'coincide' : 'no coincide'} con la identificación ${identificacion}.`)

    const aguaReference = await ninoxService.getServiceReferenceByAddress(direccion, 'agua')
    console.log('Referencia del servicio de agua:', aguaReference)

    const energiaReference = await ninoxService.getServiceReferenceByAddress(direccion, 'energía')
    console.log('Referencia del servicio de energía:', energiaReference)

    const gasReference = await ninoxService.getServiceReferenceByAddress(direccion, 'gas natural')
    console.log('Referencia del servicio de gas natural:', gasReference)

    const infoContact = await ninoxService.getPersonInfoByAddress(direccion)
    console.log('Informacion del Inquilino:', infoContact)

    const contractDocument = await ninoxService.getContractDocumentByAddress(direccion)
    console.log('Documento del contrato:', contractDocument)
    const name = await fileUtil.downloadBufferAsFile(contractDocument)
    const document = await fileUtil.openStreamAndgetFileFormData(name)

    const id = await whatsappService.uploadDocumentId(
      document,
      String(process.env.ID_NUMBER),
      String(process.env.WP_TOKEN))
    console.log(id)
    await whatsappService.sendMessageWhatsapp(
      {
        bodyText: 'Hola, elige una opción:',
        buttons: {
          inicio: 'Inicio',
          fin: 'Fin'
        },
        options: {
          // Opciones adicionales, si es necesario
        }
      },
      'button',
      String(process.env.ID_NUMBER),
      String(process.env.WP_TOKEN),
      '3054449992'
    )
    await fileUtil.closeStreamAndDeleteFile(name)
    const inventoryDocument = await ninoxService.getInventoryDocumentByAddress(direccion)
    console.log('Documento del inventario:', inventoryDocument)
  } catch (error) {
    console.error('Error:', error)
  }
} */

// eslint-disable-next-line @typescript-eslint/no-floating-promises
const ninoxService = new NinoxService()
export { ninoxService }
