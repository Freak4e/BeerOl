const app = require('../beerbackend-master');

module.exports = (req, res) => {
	if (req.url === '/api') {
		req.url = '/';
	} else if (req.url.startsWith('/api/')) {
		req.url = req.url.slice(4);
	}

	return app(req, res);
};
