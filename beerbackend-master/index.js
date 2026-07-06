const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Init app
const app = express();

// Middleware
app.use(express.json({ limit: '6mb' }));
app.use(cors());

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: {
		rejectUnauthorized: false
	}
});

// ==================
// DATABASE INIT
// ==================
async function initDB() {
	await pool.query(`
		CREATE TABLE IF NOT EXISTS teams (
			id SERIAL PRIMARY KEY,
			name TEXT UNIQUE NOT NULL,
			member1 TEXT NOT NULL,
			member2 TEXT NOT NULL
		);
	`);
	
	await pool.query(`
        CREATE TABLE IF NOT EXISTS comments (
            id SERIAL PRIMARY KEY,
            text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

	await pool.query(`
		CREATE TABLE IF NOT EXISTS moment_photos (
			id SERIAL PRIMARY KEY,
			title TEXT NOT NULL,
			image_url TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);
	`);

	await pool.query(`
		CREATE TABLE IF NOT EXISTS moment_likes (
			moment_id TEXT PRIMARY KEY,
			likes INTEGER NOT NULL DEFAULT 0
		);
	`);

	await pool.query(`
		CREATE TABLE IF NOT EXISTS moment_votes (
			moment_id TEXT NOT NULL,
			voter_key TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (moment_id, voter_key)
		);
	`);

	console.log("Database ready");
}

initDB();

const maxPongTeams = 64;

function getMailConfig() {
	const mailUser = process.env.MAIL_USER;
	const mailPass = process.env.MAIL_PASS;
	const organizerEmail = process.env.ORGANIZER_EMAIL || 'beerolympicss@gmail.com';

	if (!mailUser || !mailPass) return null;

	return {
		mailUser,
		organizerEmail,
		transporter: nodemailer.createTransport({
			service: 'gmail',
			auth: {
				user: mailUser,
				pass: mailPass
			}
		})
	};
}

function getVoterKey(req) {
	const forwardedFor = req.headers['x-forwarded-for'];
	const ip = Array.isArray(forwardedFor)
		? forwardedFor[0]
		: (forwardedFor || req.ip || req.socket.remoteAddress || '').split(',')[0].trim();
	const userAgent = req.headers['user-agent'] || '';

	return crypto
		.createHash('sha256')
		.update(`${ip}|${userAgent}`)
		.digest('hex');
}

// ==================
// ROUTES
// ==================

//post the comments
app.post('/comments', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || text.trim() === '') {
            return res.status(400).json({ error: 'Empty comment' });
        }

        if (text.split(' ').length > 50) {
            return res.status(400).json({ error: 'Max 50 words' });
        }

        const result = await pool.query(
            'INSERT INTO comments (text) VALUES ($1) RETURNING *',
            [text]
        );

        res.json(result.rows[0]);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// get the comments
app.get('/comments', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM comments ORDER BY id DESC'
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/moment-likes', async (req, res) => {
	try {
		const result = await pool.query('SELECT moment_id, likes FROM moment_likes');
		const likes = {};

		result.rows.forEach(row => {
			likes[row.moment_id] = row.likes;
		});

		res.json(likes);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Server error' });
	}
});

app.get('/moment-photos', async (req, res) => {
	try {
		const result = await pool.query(
			'SELECT id, title, image_url FROM moment_photos ORDER BY id DESC'
		);

		res.json(result.rows.map(row => ({
			id: `photo-${row.id}`,
			title: row.title,
			img: row.image_url
		})));
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Server error' });
	}
});

app.post('/moment-photos', async (req, res) => {
	try {
		const { title, imageData } = req.body;
		const cleanTitle = title && title.trim() ? title.trim() : 'Photo Submission';

		if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image/')) {
			return res.status(400).json({
				success: false,
				msg: 'Please upload a valid image.'
			});
		}

		if (imageData.length > 5 * 1024 * 1024) {
			return res.status(400).json({
				success: false,
				msg: 'Image is too large. Please use an image under 3 MB.'
			});
		}

		const result = await pool.query(
			'INSERT INTO moment_photos (title, image_url) VALUES ($1, $2) RETURNING id, title, image_url',
			[cleanTitle, imageData]
		);
		const photo = result.rows[0];

		res.json({
			success: true,
			photo: {
				id: `photo-${photo.id}`,
				title: photo.title,
				img: photo.image_url
			}
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({
			success: false,
			msg: 'Server error.'
		});
	}
});

app.post('/moment-likes/:id/like', async (req, res) => {
	try {
		const { id } = req.params;
		const voterKey = getVoterKey(req);

		const voteResult = await pool.query(
			`INSERT INTO moment_votes (moment_id, voter_key)
			 VALUES ($1, $2)
			 ON CONFLICT (moment_id, voter_key) DO NOTHING`,
			[id, voterKey]
		);

		if (voteResult.rowCount === 1) {
			await pool.query(
				`INSERT INTO moment_likes (moment_id, likes)
				 VALUES ($1, 1)
				 ON CONFLICT (moment_id)
				 DO UPDATE SET likes = moment_likes.likes + 1`,
				[id]
			);
		}

		const result = await pool.query('SELECT moment_id, likes FROM moment_likes');
		const likes = {};

		result.rows.forEach(row => {
			likes[row.moment_id] = row.likes;
		});

		res.json({
			likes,
			liked: voteResult.rowCount === 1
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Server error' });
	}
});

app.post('/tshirt-preorder', async (req, res) => {
	try {
		const { firstName, lastName, email, size, color } = req.body;

		if (!firstName || !lastName || !email || !size || !color) {
			return res.status(400).json({
				success: false,
				msg: 'Please input all fields.'
			});
		}

		const mailConfig = getMailConfig();

		if (!mailConfig) {
			return res.status(500).json({
				success: false,
				msg: 'Email is not configured on the server.'
			});
		}

		const orderText = [
			'Beer Olympics T-Shirt preorder',
			`Name: ${firstName} ${lastName}`,
			`Email: ${email}`,
			`Size: ${size}`,
			`Color: ${color}`
		].join('\n');

		await mailConfig.transporter.sendMail({
			from: `"Beer Olympics" <${mailConfig.mailUser}>`,
			to: email,
			cc: mailConfig.organizerEmail,
			subject: 'Beer Olympics T-Shirt Preorder Confirmation',
			text: `${orderText}\n\nYour preorder has been received.`
		});

		res.json({
			success: true,
			msg: 'Preorder sent.'
		});
	} catch (err) {
		console.error(err);
		if (err.code === 'EAUTH') {
			return res.status(500).json({
				success: false,
				msg: 'Email login failed. Use a Gmail App Password for MAIL_PASS.'
			});
		}

		res.status(500).json({
			success: false,
			msg: 'Server error.'
		});
	}
});

//delete a comment
app.delete('/comments/:id', async (req, res) => {
    const { id } = req.params;

    await pool.query('DELETE FROM comments WHERE id = $1', [id]);

    res.json({ success: true });
});

// Get available spaces
app.get('/', async (req, res) => {
	const teams = await pool.query('SELECT * FROM teams');

	res.json({
		pongSpacesLeft: maxPongTeams - teams.rows.length
	});
});

// RESET DATABASE ROUTE (testing)
app.get('/reset-db', async (req, res) => {
	try {
		await pool.query('TRUNCATE TABLE teams RESTART IDENTITY;');
		res.json({ success: true, msg: 'Database cleared' });
	} catch (err) {
		console.error(err);
		res.status(500).json({ success: false });
	}
});

// Register team
app.post('/', async (req, res) => {
	const { name, teammate, team } = req.body;

	if (!name || !teammate || !team) {
		return res.json({
			success: false,
			msg: 'Please input all fields.'
		});
	}

	if (name.toLowerCase() === teammate.toLowerCase()) {
		return res.json({
			success: false,
			msg: 'Members of the team cannot be the same person.'
		});
	}

	try {
		const teamsResult = await pool.query('SELECT * FROM teams');

		// Team name taken
		if (teamsResult.rows.find(t => t.name.toLowerCase() === team.toLowerCase())) {
			return res.json({
				success: false,
				msg: 'Team name already taken.'
			});
		}

		// Player already registered
		if (teamsResult.rows.find(t =>
			t.member1.toLowerCase() === name.toLowerCase() ||
			t.member2.toLowerCase() === name.toLowerCase() ||
			t.member1.toLowerCase() === teammate.toLowerCase() ||
			t.member2.toLowerCase() === teammate.toLowerCase()
		)) {
			return res.json({
				success: false,
				msg: 'Someone is already registered.'
			});
		}

		if (teamsResult.rows.length >= maxPongTeams) {
			return res.json({
				success: false,
				msg: 'No more spaces left for Beer Pong.'
			});
		}

		await pool.query(
			'INSERT INTO teams(name, member1, member2) VALUES($1, $2, $3)',
			[team, name, teammate]
		);

		try {
			const mailConfig = getMailConfig();
			if (mailConfig) {
				await mailConfig.transporter.sendMail({
					from: `"Beer Olympics" <${mailConfig.mailUser}>`,
					to: mailConfig.organizerEmail,
					subject: 'New Beer Pong Team Registration',
					text: [
						'New Beer Pong team registration',
						`Team name: ${team}`,
						`Player 1: ${name}`,
						`Player 2: ${teammate}`
					].join('\n')
				});
			}
		} catch (mailErr) {
			console.error('Registration email failed:', mailErr);
		}

		return res.json({
			success: true,
			msg: 'You have been registered for Beer Pong!',
			teamName: team,
			firstPerson: name,
			teammate
		});

	} catch (err) {
		console.error(err);
		return res.json({
			success: false,
			msg: 'Server error.'
		});
	}
});

// ==================
// START SERVER
// ==================
if (require.main === module) {
	const port = process.env.PORT || 5000;
	app.listen(port, () => {
		console.log(`Server started on port: ${port}`);
	});
}

module.exports = app;
