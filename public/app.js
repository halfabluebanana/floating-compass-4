const GeoShareApp = (() => {
    class GeoShareApp {

        constructor() {
            this.socket = io(window.location.origin);
            this.socket.on('connect', () => console.log('Socket connected successfully'));
            this.socket.on('connect_error', (error) => console.error('Socket connection error:', error));

            this.userId = this.generateUserId();
            this.roomId = null;
            this.currentLocation = null;
            this.heading = 0;
            this.otherUsers = new Map();

            // DOM Elements
            this.createRoomBtn = document.getElementById('create-room-btn');
            this.joinRoomBtn = document.getElementById('join-room-btn');
            this.roomInput = document.getElementById('room-input');
            this.roomLinkDisplay = document.getElementById('room-link-display');
            this.roomUsersElement = document.getElementById('room-users');
            this.latitudeElement = document.getElementById('latitude');
            this.longitudeElement = document.getElementById('longitude');
            this.mapHolder = document.getElementById('mapholder');
            this.compassContainer = document.getElementById('compass-container');

            this.initEventListeners();
            this.checkPermissionStatus();
            this.initializeHamburgerMenu();
        }

        generateUserId() {
            return Math.random().toString(36).substring(2, 15);
        }

        async checkPermissionStatus() {
            const locationGranted = await this.requestLocationPermission();
            if (locationGranted) {
                this.setupLocationTracking();
                this.displayUserMap();
                this.initializeCompass();

                // After location is set up, request orientation
                const orientationGranted = await this.requestDeviceOrientation();
                if (!orientationGranted) {
                    console.warn('Orientation permission denied');
                }
            } else {
                console.warn('Location permission denied');
            }
        }

        async requestLocationPermission() {
            try {
                if ('geolocation' in navigator) {
                    const position = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject);
                    });
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Error requesting location permission:', error);
                return false;
            }
        }

        async requestDeviceOrientation() {
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    const permissionState = await DeviceOrientationEvent.requestPermission();
                    if (permissionState === 'granted') {
                        //hide permissions button after enabled
                        const enablePermissionsBtn = document.getElementById('enable-permissions');
                        if (enablePermissionsBtn) {
                            enablePermissionsBtn.style.display = 'none';
                        }

                        this.addOrientationListener();
                        return true;
                    }
                    console.warn('Device orientation permission denied');
                    return false;
                } catch (error) {
                    console.error('Error requesting orientation permission:', error);
                    return false;
                }
            } else {
                // For non-iOS devices, still hide the button
                const enablePermissionsBtn = document.getElementById('enable-permissions');
                if (enablePermissionsBtn) {
                    enablePermissionsBtn.style.display = 'none';
                }

                this.addOrientationListener();
                return true;
            }
        }

        addOrientationListener() {
            window.addEventListener('deviceorientation', this.handleOrientation.bind(this));
            window.addEventListener('deviceorientationabsolute', this.handleOrientation.bind(this));
        }

        handleOrientation(event) {
            let heading;
            if (event.webkitCompassHeading) {
                heading = event.webkitCompassHeading;
            } else if (event.alpha) {
                heading = (360 - event.alpha) % 360;
            }

            if (heading !== null && heading !== undefined && !isNaN(heading)) {
                this.heading = heading;
                this.updateCompass(heading);

                // Update your compass
                const myCompass = document.querySelector(`[data-user-id="${this.userId}"] .compass-needle`);
                if (myCompass) {
                    myCompass.style.transform = `translateX(-50%) rotate(${heading}deg)`;
                }

                if (this.roomId && this.currentLocation) {
                    this.socket.emit('update-location', this.roomId, {
                        userId: this.userId,
                        orientation: heading,
                        latitude: this.currentLocation.latitude,
                        longitude: this.currentLocation.longitude
                    });
                }
            }
        }

        initializeHamburgerMenu() {
            const hamburgerBtn = document.getElementById('hamburger-menu');
            const sidePanel = document.getElementById('side-panel');

            const togglePanel = () => {
                if (sidePanel) {
                    sidePanel.classList.toggle('open');
                    console.log('Panel toggled:', sidePanel.classList.contains('open'));
                }
            };

            // click handler
            hamburgerBtn?.addEventListener('click', (e) => {
                console.log('Hamburger clicked'); // Debug log
                e.stopPropagation(); // Prevent event from bubbling

                if (sidePanel) {
                    const isOpen = sidePanel.classList.contains('open');

                    if (isOpen) {
                        sidePanel.classList.remove('open');
                        console.log('Panel closing');
                    } else {
                        sidePanel.classList.add('open');
                        console.log('Panel opening');
                    }
                }
            });

            // Close panel when clicking outside
            document.addEventListener('click', (e) => {
                const clickedInsidePanel = sidePanel?.contains(e.target);
                const clickedHamburger = hamburgerBtn?.contains(e.target);

                if (!sidePanel?.contains(e.target) &&
                    !hamburgerBtn?.contains(e.target) &&
                    sidePanel?.classList.contains('open')) {
                    sidePanel.classList.remove('open');
                    console.log('Panel closing from outside click');
                }
            });
        }


        initEventListeners() {
            this.createRoomBtn?.addEventListener('click', () => this.createRoom());
            this.joinRoomBtn?.addEventListener('click', () => this.joinRoom());

            document.getElementById('enable-permissions')?.addEventListener('click', async () => {
                const granted = await this.requestDeviceOrientation();
                if (!granted) {
                    alert("Permission not granted. Compass features will not work.");
                }
            });

            this.socket.on('location-updated', (userData) => {
                if (userData.userId !== this.userId) {
                    this.otherUsers.set(userData.userId, userData);
                    const compass = document.querySelector(`[data-user-id="${userData.userId}"] .compass-needle`);
                    if (compass && userData.orientation !== undefined) {
                        compass.style.transform = `translateX(-50%) rotate(${userData.orientation}deg)`;
                    }
                }
            });

            this.socket.on('room-created', (roomId) => {
                this.roomId = roomId;
                this.roomLinkDisplay.innerHTML = `
                    <div style="margin-bottom: 10px">
                        <strong>Room Created!</strong>
                    </div>
                    <div style="margin-bottom: 10px">
                        Room Code: <strong>${roomId}</strong>
                    </div>
                `;
                this.roomInput.value = roomId;
            });

            this.socket.on('room-joined', (roomId) => {
                this.roomId = roomId;
                this.roomLinkDisplay.innerHTML = `<strong>Joined Room:</strong> ${roomId}`;

                // Hide side panel after joining
                const sidePanel = document.getElementById('side-panel');
                if (sidePanel) {
                    sidePanel.classList.remove('open');
                }

                // Hide initial elements when joining a room
                const elementsToHide = [
                    document.getElementById('location-display'),
                    document.getElementById('compass-container'),
                    document.getElementById('enable-permissions')
                ];

                elementsToHide.forEach(element => {
                    if (element) {
                        element.style.display = 'none';
                    }
                });

                if (this.currentLocation) {
                    this.socket.emit('update-location', roomId, {
                        userId: this.userId,
                        ...this.currentLocation,
                        orientation: this.heading
                    });
                }
            });

            this.socket.on('room-update', (users) => {
                console.log('Room users updated:', users);
                this.updateRoomUsers(users);
            });

            this.socket.on('room-left', (leftUserId) => {
                // Remove the departing user
                this.otherUsers.delete(leftUserId);

                // Get current users and remove the departed user
                const remainingUsers = Array.from(this.otherUsers.values());

                // Re-render the room users grid with remaining users
                this.updateRoomUsers([
                    {
                        userId: this.userId,
                        latitude: this.currentLocation?.latitude,
                        longitude: this.currentLocation?.longitude,
                        orientation: this.heading
                    },
                    ...remainingUsers
                ]);

                // Update the "who else is here" list
                this.updateUsersList(remainingUsers);
            });

            this.checkUrlForRoom();
        }

        // Add this helper method
        updateUsersList(users) {
            if (this.roomUsersElement) {
                this.roomUsersElement.innerHTML = '<h3>who else is here</h3>';

                users.forEach(user => {
                    if (user.latitude && user.longitude) {
                        const userDiv = document.createElement('div');
                        userDiv.textContent = `User ${user.userId.substring(0, 4)}: ${user.latitude.toFixed(4)}, ${user.longitude.toFixed(4)}`;
                        this.roomUsersElement.appendChild(userDiv);
                    }
                });
            }
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
            const roomId = this.roomInput.value.trim();

            if (!roomId) {
                alert('Please enter a room ID');
                return;
            }

            this.roomId = roomId;
            const userData = {
                userId: this.userId,
                latitude: this.currentLocation?.latitude || null,
                longitude: this.currentLocation?.longitude || null,
                orientation: this.heading
            };

            this.socket.emit('join-room', roomId, userData);
        }

        setupLocationTracking() {
            if ('geolocation' in navigator) {
                const options = {
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: 5000
                };

                navigator.geolocation.watchPosition((position) => {
                    const { latitude, longitude } = position.coords;

                    // Update the location display immediately
                    if (this.latitudeElement && this.longitudeElement) {
                        this.latitudeElement.textContent = `Latitude: ${latitude.toFixed(6)}`;
                        this.longitudeElement.textContent = `Longitude: ${longitude.toFixed(6)}`;
                    }

                    //store current location
                    this.currentLocation = { latitude, longitude };

                    // update map
                    this.displayUserMap();

                    //get lat and long for each user
                    const userInfoElement = document.querySelector(`[data-user-id="${this.userId}"] .user-info`);
                    if (userInfoElement) {
                        userInfoElement.innerHTML = `
                            <div>${'You'}</div>
                            <div>Lat: ${latitude.toFixed(4)}</div>
                            <div>Long: ${longitude.toFixed(4)}</div>
                        `;
                    }

                    if (this.roomId) {
                        // Update user info display
                        const userInfoElement = document.querySelector(`[data-user-id="${this.userId}"] .user-info`);
                        if (userInfoElement) {
                            userInfoElement.innerHTML = `
                            <div>You</div>
                            <div>Lat: ${latitude.toFixed(6)}</div>
                            <div>Long: ${longitude.toFixed(6)}</div>
                        `;
                        }

                        this.socket.emit('update-location', this.roomId, {
                            userId: this.userId,
                            latitude,
                            longitude,
                            orientation: this.heading
                        });
                    }
                }, (error) => {
                    console.error('Error getting location', error);
                    this.latitudeElement.textContent = 'Location unavailable';
                    this.longitudeElement.textContent = 'Location unavailable';
                }, options);
            }
        }

        updateLocationDisplay(latitude, longitude) {
            const latDisplay = latitude ? latitude.toFixed(6) : 'N/A';
            const lonDisplay = longitude ? longitude.toFixed(6) : 'N/A';

            document.getElementById('latitude').textContent = `Latitude: ${latDisplay}`;
            document.getElementById('longitude').textContent = `Longitude: ${lonDisplay}`;
        }

        async displayUserMap() {
            try {
                if (this.currentLocation) {
                    const { latitude, longitude } = this.currentLocation;
                    const latlon = `${this.currentLocation.latitude},${this.currentLocation.longitude}`;
                    const mapImage = `https://maps.googleapis.com/maps/api/staticmap?center=${latlon}&zoom=2&size=1920x1080&maptype=hybrid&sensor=false&key=AIzaSyCuFG-NOikYAj9JOBS3oD_nhuSxlu_T8v4`;

                    if (this.mapHolder) {
                        const img = new Image();
                        img.src = mapImage;
                        img.onload = () => {
                            this.mapHolder.innerHTML = '';
                            this.mapHolder.appendChild(img);
                        };
                    }
                }
            } catch (error) {
                console.error("Error displaying map:", error);
                if (this.mapHolder) {
                    this.mapHolder.innerHTML = '<div style="text-align: center; padding: 20px;">Error loading map</div>';
                }
            }
        }

        initializeCompass() {
            if (this.compassContainer) {
                this.compassContainer.innerHTML = '';
                const mainCompass = this.createCompass('N', this.heading);
                this.compassContainer.appendChild(mainCompass);
            }
        }

        createCompass(label, orientation) {
            const compass = document.createElement('div');
            compass.className = 'compass';
            compass.innerHTML = `
                <div class="compass-needle" style="transform: translateX(-50%) rotate(${orientation}deg)"></div>
                <div class="compass-label">${label}</div>
            `;
            return compass;
        }

        updateCompass(currentOrientation) {
            const mainNeedle = document.querySelector('#compass-container .compass:first-child .compass-needle');
            if (mainNeedle) {
                mainNeedle.style.transform = `translateX(-50%) rotate(${currentOrientation}deg)`;
                console.log('Current heading:', currentOrientation);
            }
        }

        updateRoomUsers(users) {
            if (!users || !Array.isArray(users)) return;

            const mapHolder = document.getElementById('mapholder');
            const mapContainer = document.getElementById('map-container');
            mapContainer.innerHTML = ''; // Clear existing content

            // Hide initial map once in a room
            if (mapHolder) {
                mapHolder.style.display = 'none';
            }

            // // Hide single user view if multiple users
            // if (users.length > 1) {
            //     mapHolder.style.display = 'none';
            // } else {
            //     mapHolder.style.display = 'block';
            // }

            // Create grid container
            const grid = document.createElement('div');
            grid.className = `map-grid ${users.length > 1 ? 'multi-user' : ''}`;

            this.otherUsers.clear();
            this.roomUsersElement.innerHTML = '<h3>who else is here</h3>';

            users.forEach(user => {
                if (!user) return;

                // Create section for each user
                const userSection = document.createElement('div');
                userSection.className = 'user-section';
                userSection.setAttribute('data-user-id', user.userId);

                // Create map background
                if (user.latitude && user.longitude) {
                    const userMap = document.createElement('div');
                    userMap.className = 'user-map';
                    const latlon = `${user.latitude},${user.longitude}`;
                    const mapImage = `https://maps.googleapis.com/maps/api/staticmap?center=${latlon}&zoom=20&size=1920x1080&maptype=hybrid&sensor=false&key=AIzaSyCuFG-NOikYAj9JOBS3oD_nhuSxlu_T8v4`;
                    userMap.innerHTML = `<img src="${mapImage}" alt="Map">`;
                    userSection.appendChild(userMap);

                    // Add user info (lat/long)
                    const userInfo = document.createElement('div');
                    userInfo.className = 'user-info';
                    const lat = user.latitude?.toFixed(4) || 'N/A';
                    const lon = user.longitude?.toFixed(4) || 'N/A';
                    userInfo.innerHTML = `
                        <div>${user.userId === this.userId ? 'You' : `User ${user.userId.substring(0, 4)}`}</div>
                        <div>Lat: ${lat}</div>
                        <div>Long: ${lon}</div>
                    `;
                    userSection.appendChild(userInfo);

                    // Add compass for each user
                    const compass = document.createElement('div');
                    compass.className = 'compass';
                    compass.setAttribute('data-user-id', user.userId);
                    compass.innerHTML = `
                        <div class="compass-needle" style="transform: translateX(-50%) rotate(${user.orientation || 0}deg)"></div>
                        <div class="compass-label">${user.userId === this.userId ? 'You' : `User ${user.userId.substring(0, 4)}`}</div>
                    `;
                    userSection.appendChild(compass);

                    // Add to room users list
                    const userDiv = document.createElement('div');
                    userDiv.textContent = `${user.userId === this.userId ? 'You' : `User ${user.userId.substring(0, 4)}`}: ${lat}, ${lon}`;
                    this.roomUsersElement.appendChild(userDiv);
                }

                grid.appendChild(userSection);

                // Update other users collection
                if (user.userId !== this.userId) {
                    this.otherUsers.set(user.userId, user);
                }
            });

            mapContainer.appendChild(grid);
        }
    }

    // Initialize the app when the page loads
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new GeoShareApp();
    });
    return GeoShareApp;
})(); //close IIFEs

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GeoShareApp;
} else if (typeof window !== 'undefined') {
    window.GeoShareApp = GeoShareApp;
}