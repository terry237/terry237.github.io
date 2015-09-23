(function(ext) {
    // Cleanup function when the extension is unloaded
    ext._shutdown = function() {};

    // Status reporting code
    // Use this to report missing hardware, plugin or unsupported browser
    ext._getStatus = function() {
        return {status: 2, msg: 'Ready'};
    };

    ext.test_block = function() {
        // Code that gets executed when the block is run
    };
	
	ext.wait_random = function(callback) {
        wait = Math.random();
        console.log('Waiting for ' + wait + ' seconds');
        window.setTimeout(function() {
            callback();
        }, wait*1000);
    };
	
	ext.power = function(base, exponent) {
        return Math.pow(base, exponent);
    };
	
	ext.get_tmp = function(location, callback) {
        // Make an AJAX call to the Open Weather Maps API
        $.ajax({
              url: 'http://api.openweathermap.org/data/2.5/weather?q='+location+'&units=imperial',
              dataType: 'jsonp',
              success: function( weather_data ) {
                  // Got the data - parse it and return the temperature
                  temperature = weather_data['main']['temp'];
                  callback(temperature);
              }
        });
    };

    // Block and block menu descriptions
    var descriptor = {
        blocks: [
            // Block type, block name, function name, param1 default value, param2 default value
            [' ', 'my test block', 'test_block'],//普通命令
			['w', 'wait for random time', 'wait_random'],//等待
			['r', 'power %n ^ %n', 'power', 2, 3],//输出
			['R', 'current temperature in city %s', 'get_tmp', 'Boston, MA'],//等待输出，R大写
        ]
    };

    // Register the extension
    ScratchExtensions.register('Terry Robot', descriptor, ext);
})({});