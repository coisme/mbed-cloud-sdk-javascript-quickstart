$(function() {
  var socket = io();
  $('#update').hide();
  $('#provision').hide();
  $('#provision_nav').hide();
  $('#connect_nav').click(function() {
    $('#connect').show();
    $('#update').hide();
  });
  $('#update_nav').click(function() {
    $('#connect').hide();
    $('#update').show();
  });

  $('#connect_nav_small').click(function() {
    $('#connect').show();
    $('#update').hide();
  });
  $('#update_nav_small').click(function() {
    $('#connect').hide();
    $('#update').show();
  });

  $('#devices').children().each(function(index, element) {
    var _this = $(this);
    _this.find('.subscribe-presses').change(function() {
      if ($(this).is(":checked")) {
        _this.find('.get-presses').prop('disabled', true);
        socket.emit('subscribe-to-presses', {
          device: _this.attr('id')
        });
      } else {
        _this.find('.get-presses').prop('disabled', false);
        socket.emit('unsubscribe-to-presses', {
          device: _this.attr('id')
        });
      }
    });

    _this.find('.get-presses').on('click', function() {
      socket.emit('get-presses', {
        device: _this.attr('id')
      });
    });

    _this.find('.blink-pattern').bind('input', function() {
      _this.find('.update-blink-pattern').addClass('active');
    })

    _this.find('.update-blink-pattern').on('click', function() {
      socket.emit('update-blink-pattern', {
        device: _this.attr('id'),
        blinkPattern: _this.find('.blink-pattern').val()
      });

      $(this).removeClass('active');
    });

    _this.find('.blink').on('click', function() {
      socket.emit('blink', {
        device: _this.attr('id')
      });
    });
  });

  socket.on('presses', function(data) {
    console.log('presses', data);
    $('#' + data.device + ' .presses-value').html(data.value);
  });

  socket.on('subscribed-to-presses', function(data) {
    console.log('subscribed-to-presses', data);
  });

  socket.on('unsubscribed-to-presses', function(data) {
    console.log('unsubscribed-to-presses', data);
  });

  $('#generate-manifest').click(function() {
    socket.emit('generate-manifest', {});
  });

  /*
   * Stage 1: Manifest
   */
  socket.on('generated-manifest', function(data) {
    var file_path = '/update_default_resources.c';
    var a = document.createElement('A');
    a.href = file_path;
    a.download = file_path.substr(file_path.lastIndexOf('/') + 1);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  /*
   * Stage 2: Image
   */
  socket.on('connect', function() {
    var delivery = new Delivery(socket);

    delivery.on('delivery.connect', function(delivery) {

      $("#upload-image").click(function(evt) {
        var file = document.getElementById('image_file_selector').files[0];
        delivery.send(file, {
          name: 'image'
        });
        evt.preventDefault();
      });

      $("#upload-manifest").click(function(evt) {
        var file = document.getElementById('manifest_file_selector').files[0];
        delivery.send(file, {
          name: 'manifest'
        });
        evt.preventDefault();
      });
    });
  });

  /*
   * Stage 3: Campaign
   */
  $('#start-campaign').click(function() {
    socket.emit('start-campaign', {});
  });

  /*
   * Console log
   */
  socket.on('console-log', function(data) {
    $("#console-log").append(data);
  });

});
