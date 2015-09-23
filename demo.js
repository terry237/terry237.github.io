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

    // Block and block menu descriptions
    var descriptor = {
        blocks: [
            // Block type, block name, function name
            [' ', 'my test block', 'test_block'],
			['w', 'wait for random time', 'wait_random'],
        ]
    };

    // Register the extension
    ScratchExtensions.register('Terry Robot', descriptor, ext);
})({});