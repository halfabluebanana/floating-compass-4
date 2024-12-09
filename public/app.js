class GeoShareApp {
    constructor() {
        this.socket = io('http://localhost:4000');
        // this.userId = this.generateUserId();
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

    initEventListeners() {
        this.createRoomBtn.addEventListener('click', () => this.createRoom());
        this.joinRoomBtn.addEventListener('click', () => this.joinRoom());
    
       this.socket.on('room-created', (roomId) => {
            this.roomId = roomId;
            console.log('Room created:', roomId);  // Debug log
            
            // Make the room ID more visible
            this.roomLinkDisplay.innerHTML = `
                <div style="margin-bottom: 10px">
                    <strong>Room Created!</strong>
                </div>
                <div style="margin-bottom: 10px">
                    Room Code: <strong>${roomId}</strong>
                </div>
            `;
            
            // Set the room input value
            this.roomInput.value = roomId;
            
            // Alert on mobile to ensure visibility
            alert(`Room created! Your room code is: ${roomId}`);
        });
    
        // Add these new event listeners
        // Room join success event
        this.socket.on('room-joined', (roomId) => {
            console.log('Successfully joined room:', roomId);
            this.roomId = roomId;
            this.roomLinkDisplay.innerHTML = `
                <strong>Joined Room:</strong> ${roomId}
            `;
        });
    
        // Room join error event
        this.socket.on('room-join-error', (errorMessage) => {
            console.error('Room join error:', errorMessage);
            alert(errorMessage);
            this.roomLinkDisplay.innerHTML = `
                <strong>Error:</strong> ${errorMessage}
            `;
        });
    
        // Room update event
        this.socket.on('room-update', (users) => {
            console.log('Room users updated:', users);
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

    // Update your joinRoom method
joinRoom() {
    const roomId = this.roomInput.value.trim();
    
    if (!roomId) {
        alert('Please enter a room ID');
        return;
    }

    console.log('Attempting to join room:', roomId);
    this.roomId = roomId;

    const userData = {
        userId: this.userId || Math.random().toString(36).substring(2, 10), // Fallback user ID
        latitude: this.currentLocation?.latitude || null,
        longitude: this.currentLocation?.longitude || null
    };

    console.log('Joining with user data:', userData); // Debug log

     // Send join room event with current location
    this.socket.emit('join-room', roomId, userData);
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
        if (!users) {
            console.log('No users data received');
            return;
        }
    
        this.roomUsersElement.innerHTML = '<h3>Room Users</h3>';
        
        users.forEach(user => {
            const userDiv = document.createElement('div');
            // Add null checks and default values
            const userId = user?.userId || 'Unknown';
            const lat = user?.latitude ? user.latitude.toFixed(4) : 'N/A';
            const lon = user?.longitude ? user.longitude.toFixed(4) : 'N/A';
            
            userDiv.textContent = `User: ${userId.substring(0, 8)}, Lat: ${lat}, Lon: ${lon}`;
            this.roomUsersElement.appendChild(userDiv);
        });
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GeoShareApp();
});