let searchInput = document.querySelector('.search-input')
let currentWeatherDiv = document.querySelector('.current-weather')
let hourlyWeatherDiv = document.querySelector('.hourly-weather .weather-list')
let locationButton = document.querySelector('.location-button')

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
            const forcastTime = new Date(time).getTime()
            return forcastTime >= currentHour && forcastTime <= next24Hours
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
                        <p class="temperature"> ${temprature}C</p>
                    </li>
                `
        }).join('')
        
    }
    const  getWeatheDetails = async (API_URL) =>{
        // const API_URL = `http://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${cityName}&days=2`

        try {
            const response = await fetch(API_URL)
            const data = await response.json()
            const temprature = Math.floor(data.current.temp_c) 
            const description = data.current.condition.text
            const feelsLike = data.current.feelslike_c
            const humidity = data.current.humidity
            const wind_degree = data.current.wind_degree
            const wind_kph = data.current.wind_kph
            const weatherIcon = Object.keys(weatherCodes).find(icon => weatherCodes[icon].includes(data.current.condition.code))
            
            currentWeatherDiv.querySelector('.temperature').innerHTML = `${temprature} <span>C</span>`
            currentWeatherDiv.querySelector('.weather-icon').src = `./images/${weatherIcon}.svg`
            currentWeatherDiv.querySelector('.description').innerText = description
            currentWeatherDiv.querySelector('.feels-like').innerText = `Feels like: ${feelsLike}` 
            currentWeatherDiv.querySelector('.humidity').innerText = `Humidity: ${humidity}`
            currentWeatherDiv.querySelector('.wind-degree').innerText = `Wind-degree: ${wind_degree}`
            currentWeatherDiv.querySelector('.wind-kph').innerText = `Wind-kph: ${wind_kph}`

            const combindHourlyData = [...data.forecast.forecastday[0].hour, ...data.forecast.forecastday[1].hour]
            displayHourlyForcast(combindHourlyData)

            // console.log(combindHourlyData)
            
        } catch (error) {
            console.log(error)
        }
    }

    // setup aweather detail for spacific city
    const setupWeatherRequest = (cityName) =>{
        
        const API_URL = `https://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${cityName}&days=2`
        getWeatheDetails(API_URL)
    }

    // handle user input in the search box
    searchInput.addEventListener('keyup',(e)=>{
    const cityName = searchInput.value.trim()
    if(e.key == 'Enter' && cityName){
        setupWeatherRequest(cityName)
    }

    })

    // handle location button on click
    locationButton.addEventListener('click',() =>{
        navigator.geolocation.getCurrentPosition(position =>{
            const {latitude,longitude} = position.coords
            const API_URL = `https://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${latitude},${longitude}&days=2`
            getWeatheDetails(API_URL)

        },error =>{
            alert('location access denied, please enable permission to use htis feature')
        })
    })

