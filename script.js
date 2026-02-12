let searchInput = document.querySelector('.search-input')
let currentWeatherDiv = document.querySelector('.current-weather')
let hourlyWeatherDiv = document.querySelector('.hourly-weather .weather-list')
let suggestionsEl = document.querySelector('.suggestions')
let lastRequestCoords = null
let searchTimeout = null
let autoScrollInterval = null

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

// detect Arabic characters
function isArabic(text) {
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text)
}

// search using Nominatim for Arabic queries (returns Arabic display names when accept-language=ar)
async function searchNominatim(query) {
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&addressdetails=1&accept-language=ar&q=${encodeURIComponent(query)}`
        const resp = await fetch(url, { headers: { 'User-Agent': 'weather-app-local' } })
        const results = await resp.json()
        showNominatimSuggestions(results, query)
    } catch (err) {
        console.error('Nominatim search failed:', err)
    }
}

// quick fallback map for common Arabic city names to English (helps when Nominatim returns unrelated matches)
const arabicCityMap = {
    'الخرطوم': 'Khartoum, Sudan',
    'القاهرة': 'Cairo, Egypt',
    'دمشق': 'Damascus, Syria',
    'الرياض': 'Riyadh, Saudi Arabia',
    'بغداد': 'Baghdad, Iraq',
    'عمان': 'Amman, Jordan',
    'بيروت': 'Beirut, Lebanon',
    'طرابلس': 'Tripoli, Libya'
}

function showNominatimSuggestions(list, query) {
    if (!suggestionsEl) return
    if (!list || !list.length) {
        if (query && query.length >= 2) {
            suggestionsEl.innerHTML = `<li style="padding: 12px 14px; color: #ff6b6b; text-align: center;">City \"${query}\" not found</li>`
            suggestionsEl.style.display = 'block'
        } else {
            suggestionsEl.innerHTML = ''
            suggestionsEl.style.display = 'none'
        }
        return
    }

    // set RTL on suggestions and input for Arabic
    suggestionsEl.setAttribute('dir', 'rtl')
    searchInput.setAttribute('dir', 'rtl')
    // Prefer populated-place types first to avoid out-of-the-way matches
    
    const populatedTypes = ['city','town','village','hamlet','locality']

    // prepare normalizer and normalized query early (avoid usage-before-declaration)
    const normalize = str => (str || '').toString().trim().toLowerCase()
    const qNorm = normalize(query)

    const filteredList = list.filter(item => {
        if (!item) return false
        // exact match in address fields
        if (item.address) {
            const addrFields = [item.address.city, item.address.town, item.address.village, item.address.hamlet, item.address.county, item.address.state, item.address.locality]
            for (const f of addrFields) {
                if (!f) continue
                if (normalize(f) === qNorm) return true
            }
        }
        // prefer populated types
        if (item.type && populatedTypes.includes(item.type)) return true
        return false
    })
    if (filteredList.length) {
        
    }
    const useList = filteredList.length ? filteredList : list

    // Rank results: prefer exact/near-exact matches in address fields and display_name, and prefer city/town types
    const scored = useList.map((item, idx) => {
        const label = item.display_name || (item.name || query)
        const labelNorm = normalize(label)
        let score = 0

        // importance from Nominatim (0..1) scaled
        if (item.importance) score += Number(item.importance) * 100

        // exact address field match -> very high priority
        if (item.address) {
            const addr = item.address
            const fields = [addr.city, addr.town, addr.village, addr.hamlet, addr.county, addr.state, addr.locality]
            for (const f of fields) {
                if (!f) continue
                const fn = normalize(f)
                if (fn === qNorm) score += 1200
                else if (fn.startsWith(qNorm)) score += 600
                else if (fn.includes(qNorm)) score += 300
            }
        }

        // display_name matching
        if (labelNorm === qNorm) score += 900
        else if (labelNorm.startsWith(qNorm)) score += 450
        else if (labelNorm.includes(qNorm)) score += 200

        // prefer place types that represent populated places
        if (item.type && ['city','town','village','hamlet','locality'].includes(item.type)) score += 200

        // small tie-breaker to preserve original order
        score += (list.length - idx) * 0.001
        return { item, label, score }
    }).sort((a,b) => b.score - a.score)

    // debug log top candidates
    
    if (useList !== list) {
        
    }

    suggestionsEl.innerHTML = scored.map(({item,label}) => {
        return `<li data-q="${encodeURIComponent(item.lat + ',' + item.lon)}">${label}</li>`
    }).join('')
    suggestionsEl.style.display = 'block'

    Array.from(suggestionsEl.querySelectorAll('li')).forEach(li => {
        li.addEventListener('click', () => {
            const q = decodeURIComponent(li.getAttribute('data-q'))
            searchInput.value = ''
            suggestionsEl.innerHTML = ''
            suggestionsEl.style.display = 'none'
            lastRequestCoords = null
            // q will be lat,lon — WeatherAPI accepts q=lat,lon
            setupWeatherRequest(q)
        })
    })
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
        startHourlyAutoScroll()
    }

    // auto-scroll hourly weather list smoothly left and back
    function startHourlyAutoScroll() {
        if (autoScrollInterval) clearInterval(autoScrollInterval)
        if (!hourlyWeatherDiv) return
        
        let scrollDirection = 1 // 1 = left, -1 = right
        let isScrolling = false
        
        autoScrollInterval = setInterval(() => {
            if (!hourlyWeatherDiv || isScrolling) return
            const maxScroll = hourlyWeatherDiv.scrollWidth - hourlyWeatherDiv.clientWidth
            const currentScroll = hourlyWeatherDiv.scrollLeft
            
            // reverse direction at the ends
            if (currentScroll >= maxScroll - 5) scrollDirection = -1
            if (currentScroll <= 5) scrollDirection = 1
            
            hourlyWeatherDiv.scrollLeft += scrollDirection * 2
        }, 30)
    }

    const  getWeatheDetails = async (API_URL) =>{
        // const API_URL = `http://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${cityName}&days=2`

        try {
            const response = await fetch(API_URL)
            const data = await response.json()
            

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
                firstValidSuggestion.click()
                return
            }
        }
        // No suggestions available — do not auto-search. Let the user pick from suggestions.
        return
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
                suggestionsEl.removeAttribute('dir')
                searchInput.removeAttribute('dir')
            }
            return
        }
        searchTimeout = setTimeout(() => searchLocations(q), 300)
    })

    async function searchLocations(query) {
        try {
            // if Arabic characters detected, first check a small mapping (fast fallback), else use Nominatim
            if (isArabic(query)) {
                const normalize = str => (str || '').toString().trim()
                const qNorm = normalize(query)
                if (arabicCityMap[qNorm]) {
                    // show the mapped English suggestion instead of auto-searching
                    const mapped = arabicCityMap[qNorm]
                    suggestionsEl.removeAttribute('dir')
                    searchInput.removeAttribute('dir')
                    suggestionsEl.innerHTML = `<li data-q="${encodeURIComponent(mapped)}">${mapped}</li>`
                    suggestionsEl.style.display = 'block'
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
                    return
                }
                await searchNominatim(query)
                return
            }

            const url = `https://api.weatherapi.com/v1/search.json?key=${API_KEY}&q=${encodeURIComponent(query)}`
            const resp = await fetch(url)
            const results = await resp.json()
            // ensure LTR for non-Arabic results
            suggestionsEl.removeAttribute('dir')
            searchInput.removeAttribute('dir')
            showSuggestions(results, query)
        } catch (err) {
            console.error('Location search failed:', err)
        }
    }

    function showSuggestions(list, query) {
        if (!suggestionsEl) return
        if (!list || !list.length) {
            if (query && query.length >= 2) {
                suggestionsEl.innerHTML = `<li style="padding: 12px 14px; color: #ff6b6b; text-align: center;">City \"${query}\" not found</li>`
                suggestionsEl.style.display = 'block'
            } else {
                suggestionsEl.innerHTML = ''
                suggestionsEl.style.display = 'none'
            }
            return
        }

        // Rank WeatherAPI search suggestions: prefer name/region that startsWith query, then includes
        const normalize = s => (s || '').toString().trim().toLowerCase()
        const qNorm = normalize(query)

        const scored = list.map((item, idx) => {
            const name = item.name || ''
            const region = item.region || ''
            const country = item.country || ''
            const label = `${name}${region ? ', ' + region : ''}, ${country}`
            const nameNorm = normalize(name)
            const regionNorm = normalize(region)
            const countryNorm = normalize(country)
            let score = 0
            if (nameNorm === qNorm) score += 1000
            else if (nameNorm.startsWith(qNorm)) score += 600
            else if (nameNorm.includes(qNorm)) score += 300
            if (regionNorm === qNorm) score += 200
            else if (regionNorm.includes(qNorm)) score += 80
            if (countryNorm === qNorm) score += 150
            // small boost for results earlier in the list
            score += (list.length - idx) * 0.5
            return { item, label, score }
        }).sort((a,b) => b.score - a.score)

    

        suggestionsEl.innerHTML = scored.map(({item,label}) => `<li data-q="${encodeURIComponent(item.name + (item.region ? ', ' + item.region : '') + ', ' + item.country)}">${label}</li>`).join('')
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






