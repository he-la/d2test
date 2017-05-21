/*
EXPRESS HTTP SERVER
*/
const express = require('express')  
const app = express()
const cookieParser = require('cookie-parser') //currently not used
const morgan = require('morgan')
const path = require('path')
const port = 33333

app.use(cookieParser())// middleware; speaks for itself
app.use(morgan('common')) // logger middleware

app.use(express.static(path.join(__dirname, 'public')))//serve static content

app.post('/', (req, res) => { // todo
	res.sendStatus(200);
})

app.listen(port, (err) => {  
	if (err)
		return console.log('something bad happened', err)

	console.log(`server is listening on ${port}`)
})