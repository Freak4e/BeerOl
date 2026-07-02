const express = require('express');
const path = require('path');
const backend = require('./beerbackend-master');

const app = express();
const port = process.env.PORT || 3000;
const frontendRoot = path.join(__dirname, 'beerolympics-master');

app.use('/api', backend);
app.use(express.static(frontendRoot));

app.get('/', (req, res) => {
	res.sendFile(path.join(frontendRoot, 'index.html'));
});

app.listen(port, () => {
	console.log(`Beer Olympics local dev server running at http://localhost:${port}`);
});
