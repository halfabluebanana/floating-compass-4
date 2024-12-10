class GeoShareApp {
    constructor() {
        this.socket = io(window.location.origin);
        // Add connection status logging
        this.socket.on('connect', () => {
            console.log('Socket connected successfully');
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });

        this.singaporeCoords = {
            latitude: 1.3521,
            longitude: 103.8198
        };

        // Store other users' locations
        this.otherUsers = new Map();

        // Add reference cities for similar coordinates
        this.referenceLocations = [
            { name: 'Manila', latitude: 14.5995, longitude: 120.9842 },
            { name: 'Jakarta', latitude: -6.2088, longitude: 106.8456 },
            { name: 'Ho Chi Minh City', latitude: 10.8231, longitude: 106.6297 },
            { name: 'Kuala Lumpur', latitude: 3.1390, longitude: 101.6869 }
        ];

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

    findSimilarLocations(latitude, longitude, threshold = 5) {
        const similar = {
            latitude: [],
            longitude: []
        };

        this.referenceLocations.forEach(location => {
            if (Math.abs(location.latitude - latitude) <= threshold) {
                similar.latitude.push(location);
            }
            if (Math.abs(location.longitude - longitude) <= threshold) {
                similar.longitude.push(location);
            }
        });

        return similar;
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
        const handleOrientation = (event) => {
            // Get compass heading (alpha) in degrees
            let heading = event.webkitCompassHeading || event.alpha;

            // Convert WebKit heading to standard orientation
            if (event.webkitCompassHeading) {
                // WebKit compass heading is already in degrees clockwise from North
                heading = event.webkitCompassHeading;
            } else if (event.alpha) {
                // Alpha is in degrees counter-clockwise from West
                // Convert to clockwise from North
                heading = (360 - event.alpha + 270) % 360;
            }

            // Update compasses with the new heading
            if (heading !== null && heading !== undefined) {
                this.updateCompasses(heading);
            }

            // Broadcast orientation if in a room
            if (this.roomId && this.currentLocation) {
                this.socket.emit('update-location', this.roomId, {
                    userId: this.userId,
                    orientation: heading,
                    latitude: this.currentLocation.latitude,
                    longitude: this.currentLocation.longitude
                });
            }
        };

        // Request permission for iOS devices
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(response => {
                    if (response === 'granted') {
                        window.addEventListener('deviceorientation', handleOrientation, true);
                    }
                })
                .catch(console.error);
        } else {
            // Add listener directly for non-iOS devices
            window.addEventListener('deviceorientation', handleOrientation, true);
        }
    }

    updateRoomUsers(users) {
        if (!users) {
            console.log('No users data received');
            return;
        }
        // Clear previous users
        this.otherUsers.clear();

        this.roomUsersElement.innerHTML = '<h3>Room Users</h3>';

        users.forEach(user => {
            if (user.userId !== this.userId) {
                this.otherUsers.set(user.userId, {
                    latitude: user.latitude,
                    longitude: user.longitude,
                    orientation: user.orientation
                });
            }

            const userDiv = document.createElement('div');
            // Add null checks and default values
            const userId = user?.userId || 'Unknown';
            const lat = user?.latitude ? user.latitude.toFixed(4) : 'N/A';
            const lon = user?.longitude ? user.longitude.toFixed(4) : 'N/A';

            userDiv.textContent = `User: ${userId.substring(0, 8)}, Lat: ${lat}, Lon: ${lon}`;
            this.roomUsersElement.appendChild(userDiv);
        });

        this.updateCompasses();

        if (this.currentLocation) {
            const similar = this.findSimilarLocations(
                this.currentLocation.latitude,
                this.currentLocation.longitude
            );
            this.displaySimilarLocations(similar);
        }
    }

    updateCompasses(currentOrientation = 0) {
        const compassContainer = document.getElementById('compass-container');
        compassContainer.innerHTML = '';

        // Create main compass
        const mainCompass = document.createElement('div');
        mainCompass.className = 'compass';
        mainCompass.innerHTML = `
            <div class="needle" id="main-needle" style="transform: rotate(${-currentOrientation}deg)"></div>
            <div class="compass-label">Your Compass</div>
            <div class="compass-target">Pointing to: North</div>
        `;
        compassContainer.appendChild(mainCompass);

        if (this.currentLocation) {
            if (this.otherUsers.size > 0) {
                this.otherUsers.forEach((userData, userId) => {
                    if (userData.latitude && userData.longitude) {
                        const targetBearing = this.calculateBearing(
                            this.currentLocation.latitude,
                            this.currentLocation.longitude,
                            userData.latitude,
                            userData.longitude
                        );

                        const userCompass = document.createElement('div');
                        userCompass.className = 'compass';

                        // Calculate relative bearing based on current orientation
                        const relativeBearing = (targetBearing + currentOrientation + 360) % 360;

                        userCompass.innerHTML = `
                            <div class="needle" style="transform: translateX(-50%) rotate(${relativeBearing}deg)"></div>
                            <div class="compass-label">Points to User ${userId.substring(0, 4)}</div>
                            <div class="compass-target">Bearing: ${Math.round(targetBearing)}°</div>
                        `;
                        compassContainer.appendChild(userCompass);
                    }
                });
            } else {
                // Point to Singapore
                const targetBearing = this.calculateBearing(
                    this.currentLocation.latitude,
                    this.currentLocation.longitude,
                    this.singaporeCoords.latitude,
                    this.singaporeCoords.longitude
                );

                const relativeBearing = (targetBearing - currentOrientation + 360) % 360;

                const userCompass = document.createElement('div');
                userCompass.className = 'compass';
                userCompass.innerHTML = `
                <div class="needle" style="transform: translateX(-50%) rotate(${relativeBearing}deg)"></div>
                    <div class="compass-label">Points to Singapore</div>
                    <div class="compass-target">Bearing: ${Math.round(targetBearing)}°</div>
                `;
                compassContainer.appendChild(userCompass);
            }
        }
    }

    calculateBearing(startLat, startLng, endLat, endLng) {
        // Convert to radians
        startLat = startLat * Math.PI / 180;
        startLng = startLng * Math.PI / 180;
        endLat = endLat * Math.PI / 180;
        endLng = endLng * Math.PI / 180;

        const y = Math.sin(endLng - startLng) * Math.cos(endLat);
        const x = Math.cos(startLat) * Math.sin(endLat) -
            Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
        let bearing = Math.atan2(y, x);
        bearing = bearing * 180 / Math.PI;
        return (bearing + 360) % 360;
    }

    displaySimilarLocations(similar) {
        const container = document.createElement('div');
        container.className = 'similar-locations';
        container.innerHTML = `
            <h4>Locations with Similar Coordinates:</h4>
            ${similar.latitude.length > 0 ?
                `<p>Similar Latitude: ${similar.latitude.map(l => l.name).join(', ')}</p>` :
                ''}
            ${similar.longitude.length > 0 ?
                `<p>Similar Longitude: ${similar.longitude.map(l => l.name).join(', ')}</p>` :
                ''}
        `;
        this.roomUsersElement.appendChild(container);
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GeoShareApp();
});