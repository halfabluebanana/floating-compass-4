class GeoShareApp {
    constructor() {
        this.socket = io('http://localhost:4000');
        this.userId = this.generateUserId();
        this.roomId = null;
        this.currentLocation = null;

        // DOM Elements
        this.createRoomBtn = document.getElementById('create-room-btn');
        this.joinRoomBtn = document.getElementById('join-room-btn');
        this.roomInput = document.getElementById('room-input');
        this.roomLinkDisplay = document.getElementById('room-link-display');
        this.roomUsersElement = document.getElementById('room-users');
        this.latitudeElement = document.getElementById('latitude');
        this.longitudeElement = document.getElementById('longitude');
        this.needle = document.getElementById('needle');

        this.initEventListeners();
        this.setupLocationTracking();
        this.setupOrientationTracking();
    }

    generateUserId() {
        return Math.random().toString(36).substring(2, 15);
    }

    initEventListeners() {
        this.createRoomBtn.addEventListener('click', () => this.createRoom());
        this.joinRoomBtn.addEventListener('click', () => this.joinRoom());

        this.socket.on('room-created', (roomId) => {
            this.roomId = roomId;
            const shareLink = `${window.location.origin}?room=${roomId}`;
            this.roomLinkDisplay.innerHTML = `
                <strong>Room Created!</strong><br>
                Share this link: <a href="${shareLink}">${shareLink}</a>
            `;
        });

        this.socket.on('room-update', (users) => {
            this.updateRoomUsers(users);
        });

        // Check for room in URL on page load
        this.checkUrlForRoom();
    }

    checkUrlForRoom() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomFromUrl = urlParams.get('room');
        
        if (roomFromUrl) {
            this.roomInput.value = roomFromUrl;
            this.joinRoom();
        }
    }

    createRoom() {
        this.socket.emit('create-room');
    }

    joinRoom() {
        this.roomId = this.roomInput.value;
        
        if (this.roomId) {
            this.socket.emit('join-room', this.roomId, {
                userId: this.userId,
                latitude: this.currentLocation?.latitude,
                longitude: this.currentLocation?.longitude
            });
        }
    }

    setupLocationTracking() {
        if ('geolocation' in navigator) {
            navigator.geolocation.watchPosition((position) => {
                const { latitude, longitude } = position.coords;
                
                // Update location display
                this.latitudeElement.textContent = `Latitude: ${latitude.toFixed(4)}`;
                this.longitudeElement.textContent = `Longitude: ${longitude.toFixed(4)}`;
                
                this.currentLocation = { latitude, longitude };

                // Broadcast location if in a room
                if (this.roomId) {
                    this.socket.emit('update-location', this.roomId, {
                        userId: this.userId,
                        latitude,
                        longitude
                    });
                }
            }, (error) => {
                console.error('Error getting location', error);
                this.latitudeElement.textContent = 'Location unavailable';
                this.longitudeElement.textContent = 'Location unavailable';
            });
        } else {
            alert('Geolocation is not supported by your browser');
        }
    }

    setupOrientationTracking() {
        window.addEventListener('deviceorientation', (event) => {
            const compassHeading = event.alpha || 0;
            
            // Rotate compass needle
            this.needle.style.transform = `translateX(-50%) rotate(${compassHeading}deg)`;

            // Broadcast orientation if in a room
            if (this.roomId) {
                this.socket.emit('update-location', this.roomId, {
                    userId: this.userId,
                    orientation: compassHeading
                });
            }
        });
    }

    updateRoomUsers(users) {
        this.roomUsersElement.innerHTML = '<h3>Room Users</h3>';
        
        users.forEach(user => {
            const userDiv = document.createElement('div');
            userDiv.textContent = `User: ${user.userId.substring(0, 8)}, Lat: ${user.latitude?.toFixed(4) || 'N/A'}, Lon: ${user.longitude?.toFixed(4) || 'N/A'}`;
            this.roomUsersElement.appendChild(userDiv);
        });
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GeoShareApp();
});