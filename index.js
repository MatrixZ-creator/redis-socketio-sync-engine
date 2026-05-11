import http from 'node:http'
import express from 'express'
import path from 'node:path'
import { Server } from 'socket.io'

import { publishers, subscribers, redis } from './redis-connection.js'


async function main() {

    const CHECK_BOX = 100
    const CHECK_BOX_KEY ='checkbox-state'

    const state = {
        checkbox: new Array(CHECK_BOX).fill(false)
    }

    const app = express()

    const server = http.createServer(app)

    const PORT = process.env.PORT ?? 8080

    const io = new Server(server)

    subscribers.subscribe('checkbox-change');
    subscribers.on('message',(channel,message)=>{
        if(channel === 'checkbox-change'){
            const { index, checked } =JSON.parse(message)
            state.checkbox[index] = checked
            io.emit('server:checkbox:change',{index,checked})
        }
    })


    io.on('connection', (socket) => {
        console.log('socket connected', { id: socket.id })
        socket.on('client:checkbox:change',async(data) => {
            console.log(`Socket ${socket.id}`, data)
            // state.checkbox[data.index] = data.checked
            // io.emit('server:checkbox:change', data)
            const existingstate = await redis.get(CHECK_BOX_KEY)
            if(existingstate){
                const remotedata=JSON.parse(existingstate)
                remotedata[data.index]=data.checked
                await redis.set(CHECK_BOX_KEY,JSON.stringify(remotedata))
            }
            else{
                redis.set(CHECK_BOX_KEY,JSON.stringify(new Array(CHECK_BOX).fill(false)))
            }
            await publishers.publish('checkbox-change',JSON.stringify(data))
        })
    })

    app.get('/checkbox', async(req, res) => {
        const existingstate = await redis.get(CHECK_BOX_KEY)
        if(existingstate){
                const remotedata=JSON.parse(existingstate)
            return res.json({
                checkbox:remotedata
            })
            }

        return res.json({
            checkbox: []
        })
    })

    app.use(express.static(path.resolve('./public')))

    server.listen(PORT, () => {
        console.log(`server is running in port ${PORT}`)
    })
}

main()