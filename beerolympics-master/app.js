const BACKEND_URL = '/api';

document.addEventListener('DOMContentLoaded', () => {
	initModals();
	initNavbar();
	initRegisterForm();
	initTagCloud();
	loadComments();
	initTshirtPreorder();
});

window.addEventListener('scroll', toggleFixedNavbar);
window.addEventListener('click', handleWindowClick);

function initModals() {
	document.querySelectorAll('.modal').forEach(modal => {
		modal.addEventListener('click', hideModal);
	});
}

function hideModal(e) {
	if (e.target.classList.contains('modal')) {
		e.target.classList.remove('show-modal');
		document.body.classList.remove('frozen');
	}
}

function showModal(modalId) {
	const modalEl = document.getElementById(modalId);
	if (!modalEl) return;

	modalEl.classList.add('show-modal');
	document.body.classList.add('frozen');
}

function initNavbar() {
	const menuIcon = document.querySelector('.menu-icon');
	if (menuIcon) menuIcon.addEventListener('click', toggleHamburgerMenu);
}

function toggleFixedNavbar() {
	const navbarEl = document.querySelector('.navbar-wrapper');
	if (!navbarEl) return;

	const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
	navbarEl.classList.toggle('scrolled-nav', scrollTop !== 0);
}

function handleWindowClick(e) {
	if (e.target.classList.contains('menu-icon')) return;

	const links = document.querySelector('.hamburger-menu-links');
	if (links) links.classList.add('hidden');
}

function toggleHamburgerMenu() {
	const links = document.querySelector('.hamburger-menu-links');
	if (links) links.classList.toggle('hidden');
}

function initRegisterForm() {
	const form = document.querySelector('.register-form');
	if (!form) return;

	form.addEventListener('submit', handleFormSubmit);
}

function handleFormSubmit(e) {
	e.preventDefault();

	const formData = getFormData();
	if (!formData) return;

	const submitBtn = document.querySelector('.btn-blwhite');
	if (submitBtn) submitBtn.textContent = 'Loading...';

	postData(BACKEND_URL, formData);
}

function getFormData() {
	const name = document.getElementById('name')?.value.trim();
	const pongTeammate = document.getElementById('teammate')?.value.trim();
	const pongTeam = document.getElementById('team')?.value.trim();

	if (!name) return sendErrorMessage('Please input your name.');
	if (name.split(' ').length <= 1) return sendErrorMessage('Please input last name as well.');
	if (!pongTeammate) return sendErrorMessage("Please input your teammate's name.");
	if (pongTeammate.split(' ').length <= 1) return sendErrorMessage('Please input last names as well.');
	if (!pongTeam) return sendErrorMessage("Please input your team's name.");

	return {
		name,
		pong: true,
		teammate: pongTeammate,
		team: pongTeam
	};
}

function sendErrorMessage(message) {
	const small = document.querySelector('.register-form small, #tshirtMessage');
	if (small) {
		small.textContent = message;
		small.style.color = '#ff0000';
	}
	return false;
}

function sendSuccessMessage(message) {
	const small = document.querySelector('.register-form small, #tshirtMessage');
	if (small) {
		small.textContent = message;
		small.style.color = '#2d8a20';
	}
}

async function postData(url, data) {
	const submitBtn = document.querySelector('.btn-blwhite');

	try {
		const response = await fetch(url, {
			method: 'POST',
			mode: 'cors',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});

		const responseJSON = await response.json().catch(() => ({
			success: false,
			msg: 'Server returned an invalid response.'
		}));

		if (!response.ok && !responseJSON.msg) {
			responseJSON.msg = 'Server error.';
		}

		handleResponseJSON(responseJSON);
	} catch (err) {
		console.error('Registration request failed:', err);
		if (submitBtn) submitBtn.textContent = 'Submit';
		sendErrorMessage('Could not connect to the server.');
	}
}

function handleResponseJSON(data) {
	const submitBtn = document.querySelector('.btn-blwhite');
	if (!data.success) {
		if (submitBtn) submitBtn.textContent = 'Submit';
		return sendErrorMessage(data.msg || 'Registration failed.');
	}

	if (submitBtn) {
		submitBtn.textContent = 'Registered!';
		setTimeout(() => {
			submitBtn.textContent = 'Submit';
		}, 4000);
	}

	sendSuccessMessage(data.msg);
	document.querySelector('.register-form')?.reset();
}

function initTagCloud() {
	if (!window.TagCanvas || !document.getElementById('canvas') || !document.getElementById('tags-list')) return;

	try {
		TagCanvas.Start('canvas', 'tags-list', {
			outlineColour: '#fafafa00',
			depth: 0.7,
			maxSpeed: 0.03,
			imageMode: 'image',
			imageScale: 0.45,
			minBrightness: 0.5,
			noMouse: true,
			noSelect: true,
			zoom: 1,
			maxZoom: 1,
			minZoom: 1
		});
		TagCanvas.SetSpeed('canvas', [-0.15, 0.1]);
	} catch (err) {
		console.error('Tag cloud failed:', err);
	}
}

async function loadComments() {
	const boxes = document.querySelectorAll('.floating-box');
	if (!boxes.length) return;

	try {
		const res = await fetch(`${BACKEND_URL}/comments`);
		const data = await res.json();

		boxes.forEach((box, index) => {
			box.classList.remove('used');
			box.textContent = 'Leave a comment';

			if (data[index]) {
				box.textContent = data[index].text;
				box.classList.add('used');
				box.onclick = null;
				return;
			}

			box.onclick = async e => {
				e.stopPropagation();
				const text = prompt('Write your comment (max 50 words):');
				if (!text || !text.trim()) return;

				await fetch(`${BACKEND_URL}/comments`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ text: text.trim() })
				});

				loadComments();
			};
		});
	} catch (err) {
		boxes.forEach(box => {
			box.textContent = 'Comments unavailable';
		});
		console.error('Could not load comments:', err);
	}
}

function initTshirtPreorder() {
	const form = document.getElementById('tshirtForm');
	if (!form) return;

	form.addEventListener('submit', async e => {
		e.preventDefault();

		const formData = new FormData(form);
		const payload = {
			firstName: formData.get('firstName')?.trim(),
			lastName: formData.get('lastName')?.trim(),
			email: formData.get('email')?.trim(),
			size: formData.get('size'),
			color: formData.get('color')
		};

		const btn = form.querySelector('.order-btn');
		if (btn) btn.textContent = 'Sending...';

		try {
			const res = await fetch(`${BACKEND_URL}/tshirt-preorder`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const data = await res.json();

			if (!data.success) {
				sendErrorMessage(data.msg || 'Order failed.');
				return;
			}

			sendSuccessMessage('Preorder sent. Check your email for confirmation.');
			form.reset();
		} catch (err) {
			sendErrorMessage('Could not send preorder.');
		} finally {
			if (btn) btn.textContent = 'Order';
		}
	});
}
