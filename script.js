let searchInput = document.querySelector('.search-input')
let currentWeatherDiv = document.querySelector('.current-weather')
let hourlyWeatherDiv = document.querySelector('.hourly-weather .weather-list')
let suggestionsEl = document.querySelector('.suggestions')
let lastRequestCoords = null
let searchTimeout = null

    const API_KEY = '6742520530b04ddaaf934118261102'
    const weatherCodes = {
        clear: [1000],
        clouds: [1003,1006,1009],
        mist: [1030,1135,1147],
        rain: [1063,1150,1153,1168,1171,1180,1183,1198,1201,1240,1273,1276],
        moderate_heavy_rain: [1186,1189,1192,1195,1243,1246],
        snow: [1066,1069,1072,1114,1117,1204,1207,1210,1213,1216,1219,1222,1225,1237,1249,1252,1255,1258,1261,1264,1279,1282],
        thunder: [1087,1279,1282],
        thunder_rain: [1273,1276]

    }

    const displayHourlyForcast = (hourlyData)=>{
        const currentHour = new Date().setMinutes(0,0,0)
        const next24Hours = currentHour + 24 * 60 * 60 * 1000
        // filter the hourly data to only include  the next 24 hours
        const next24HoursData = hourlyData.filter(({time})=>{
            const forecastTime = new Date(time).getTime()
            return forecastTime >= currentHour && forecastTime <= next24Hours
        })
        //generate html for each hourly forcast and display it
        hourlyWeatherDiv.innerHTML = ''
        hourlyWeatherDiv.innerHTML = next24HoursData.map(item =>{
            const temprature = Math.floor(item.temp_c) 
            const time = item.time.split(' ')[1].substring(0,5)
            const weatherIcon = Object.keys(weatherCodes).find(icon => weatherCodes[icon].includes(item.condition.code))
            return `
                    <li class="weather-item">
                        <p class="time"> ${time}</p>
                        <img class="weather-icon" src="./images/${weatherIcon}.svg" alt="">
                        <p class="temperature"> ${temprature}°C</p>
                    </li>
                `
        }).join('')
        
    }
    const  getWeatheDetails = async (API_URL) =>{
        // const API_URL = `http://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${cityName}&days=2`

        try {
            const response = await fetch(API_URL)
            const data = await response.json()
            console.log('Weather API response:', data)

            if (!data || !data.location) {
                console.error('Unexpected API response (no location):', data)
                const errorMsg = data && data.error ? data.error.message : 'City not found. Please check the name and try again.'
                alert(errorMsg)
                return
            }

            const temprature = Math.floor(data.current.temp_c)
            const description = data.current.condition.text
            const feelsLike = data.current.feelslike_c
            const humidity = data.current.humidity
            const wind_degree = data.current.wind_degree
            const wind_kph = data.current.wind_kph
            const weatherIcon = Object.keys(weatherCodes).find(icon => weatherCodes[icon].includes(data.current.condition.code))

            currentWeatherDiv.querySelector('.temperature').innerHTML = `${temprature}°`
            currentWeatherDiv.querySelector('.weather-icon').src = `./images/${weatherIcon}.svg`
            currentWeatherDiv.querySelector('.description').innerText = description
            currentWeatherDiv.querySelector('.feels-like').innerText = `Feels like: ${feelsLike}`
            currentWeatherDiv.querySelector('.humidity').innerText = `Humidity: ${humidity}`
            currentWeatherDiv.querySelector('.wind-degree').innerText = `Wind-degree: ${wind_degree}`
            currentWeatherDiv.querySelector('.wind-kph').innerText = `Wind-kph: ${wind_kph}`

            const forecastDays = data.forecast && data.forecast.forecastday ? data.forecast.forecastday : []
            let combindHourlyData = []
            if (forecastDays.length >= 2) {
                combindHourlyData = [...forecastDays[0].hour, ...forecastDays[1].hour]
            } else if (forecastDays.length === 1) {
                combindHourlyData = [...forecastDays[0].hour]
            }

            if (combindHourlyData.length) displayHourlyForcast(combindHourlyData)

            console.log('Resolved location:', data.location)

            // Display city and country beside the temperature
            const locationDisplayEl = currentWeatherDiv.querySelector('.location-display')
            if (locationDisplayEl) {
                locationDisplayEl.innerText = `${data.location.name}, ${data.location.country}`
            }

            // if we requested by GPS coords, show how far the resolved named location is
            const locationNoteEl = currentWeatherDiv.querySelector('.location-note')
            if (lastRequestCoords && data.location && data.location.lat && data.location.lon) {
                const userLat = Number(lastRequestCoords.lat)
                const userLon = Number(lastRequestCoords.lon)
                const resolvedLat = Number(data.location.lat)
                const resolvedLon = Number(data.location.lon)
                const distanceKm = computeDistanceKm(userLat, userLon, resolvedLat, resolvedLon)
                locationNoteEl.innerText = `Nearest named place: ${data.location.name} — ${distanceKm.toFixed(2)} km from your device`
            } else {
                locationNoteEl.innerText = ''
            }

        } catch (error) {
            console.error('Error fetching weather data:', error)
            alert('Error fetching weather data. See console for details.')
        }
    }

    // helper: compute great-circle distance (km)
    function computeDistanceKm(lat1, lon1, lat2, lon2) {
        const toRad = (deg) => deg * Math.PI / 180
        const R = 6371 // Earth's radius km
        const dLat = toRad(lat2 - lat1)
        const dLon = toRad(lon2 - lon1)
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                  Math.sin(dLon/2) * Math.sin(dLon/2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
        return R * c
    }

    // setup aweather detail for spacific city
    const setupWeatherRequest = (cityName) =>{
        const q = encodeURIComponent(cityName)
        let API_URL = `https://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${q}&days=2`
        getWeatheDetails(API_URL)
    }

    // handle user input in the search box
    searchInput.addEventListener('keyup', async (e)=>{
    const cityName = searchInput.value.trim()
    if(e.key == 'Enter' && cityName){
        // If suggestions are NOT visible yet, trigger search first
        if (!suggestionsEl || suggestionsEl.style.display !== 'block') {
            // Cancel debounce and search immediately
            clearTimeout(searchTimeout)
            await searchLocations(cityName)
            // Small delay to allow suggestions to render
            await new Promise(resolve => setTimeout(resolve, 100))
        }
        
        // Now auto-select the first valid result
        if (suggestionsEl && suggestionsEl.style.display === 'block') {
            const suggestions = Array.from(suggestionsEl.querySelectorAll('li'))
            // Find first suggestion that has data-q attribute (actual search results, not error message)
            const firstValidSuggestion = suggestions.find(li => li.getAttribute('data-q'))
            if (firstValidSuggestion) {
                console.log('Auto-selecting first suggestion:', firstValidSuggestion.innerText)
                firstValidSuggestion.click()
                return
            }
        }
        // Fallback: if still no valid suggestions, proceed with direct query
        lastRequestCoords = null
        setupWeatherRequest(cityName)
    }

    })

    // debounce and search suggestions using WeatherAPI search endpoint
    searchInput.addEventListener('input', (e) => {
        const q = searchInput.value.trim()
        clearTimeout(searchTimeout)
        if (!q || q.length < 2) {
            if (suggestionsEl) {
                suggestionsEl.innerHTML = ''
                suggestionsEl.style.display = 'none'
            }
            return
        }
        searchTimeout = setTimeout(() => searchLocations(q), 300)
    })

    async function searchLocations(query) {
        try {
            const url = `https://api.weatherapi.com/v1/search.json?key=${API_KEY}&q=${encodeURIComponent(query)}`
            const resp = await fetch(url)
            const results = await resp.json()
            showSuggestions(results, query)
        } catch (err) {
            console.error('Location search failed:', err)
        }
    }

    function showSuggestions(list, query) {
    if (!suggestionsEl) return
    if (!list || !list.length) {
        if (query && query.length >= 2) {
            suggestionsEl.innerHTML = `<li style="padding: 12px 14px; color: #ff6b6b; text-align: center;">City "${query}" not found</li>`
            suggestionsEl.style.display = 'block'
        } else {
            suggestionsEl.innerHTML = ''
            suggestionsEl.style.display = 'none'
        }
        return
    }
    suggestionsEl.innerHTML = list.map(item => `<li data-q="${encodeURIComponent(item.name + (item.region ? ', ' + item.region : '') + ', ' + item.country)}">${item.name}${item.region ? ', ' + item.region : ''}, ${item.country}</li>`).join('')
    suggestionsEl.style.display = 'block'
        // attach click handlers
        Array.from(suggestionsEl.querySelectorAll('li')).forEach(li => {
            li.addEventListener('click', () => {
                const q = decodeURIComponent(li.getAttribute('data-q'))
                searchInput.value = ''
                suggestionsEl.innerHTML = ''
                suggestionsEl.style.display = 'none'
                lastRequestCoords = null
                setupWeatherRequest(q)
            })
        })
    }

    // hide suggestions when clicking outside
    document.addEventListener('click', (ev) => {
        if (!ev.target.closest('.input-wrapper')) {
            if (suggestionsEl) {
                suggestionsEl.innerHTML = ''
                suggestionsEl.style.display = 'none'
            }
        }
    })






