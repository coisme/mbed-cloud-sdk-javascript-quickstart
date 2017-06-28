/* On page refresh or page load, if an anchor tag exists in the URL, open
   the corresponding content module (i.e. /#update will tell the website to
   show the "Update" content div). If no anchor tag is present, the page will
   load the "Connect" content by default. */
document.addEventListener('DOMContentLoaded', function() {
  var hash = window.location.hash.substr(1);
  console.log(hash)
  if (hash == "connect") {
    /* Add CSS class "is-active" to the #connect_nav tab */
    $('#connect_nav').addClass("is-active");
    /* Remove CSS class "is-active" from the #update_nav tab */
    $('#update_nav').removeClass("is-active");
    $('#connect').show();
    $('#update').hide();
  } else if (hash == "update") {
    $('#update_nav').addClass("is-active");
    $('#connect_nav').removeClass("is-active");
    $('#connect').hide();
    $('#update').show();
  } else {
    $('#connect_nav').addClass("is-active");
    $('#update_nav').removeClass("is-active");
    $('#connect').show();
    $('#update').hide();
  }
});

$(function() {
  var socket = io();

/* On navigation tab click, show the corresponding div content from it's id. */
  $('#update').hide();
  $('#provision').hide();
  $('#provision_nav').hide();
  $('#provision_nav_small').hide();
  $('#connect_nav').click(function() {
    $('#connect_nav').addClass("is-active");
    $('#update_nav').removeClass("is-active");
    $('#connect').show();
    $('#update').hide();
  });
  $('#update_nav').click(function() {
    $('#update_nav').addClass("is-active");
    $('#connect_nav').removeClass("is-active");
    $('#connect').hide();
    $('#update').show();
  });


  $('#devices').children().each(function(index, element) {
    var _this = $(this);
    _this.find('.subscribe-presses').change(function() {
      if ($(this).is(":checked")) {
        _this.find('.get-presses').prop("disabled", true);
        _this.find('.get-presses').addClass("no-hover");
        socket.emit('subscribe-to-presses', {
          device: _this.attr('id')
        });
      } else {
        _this.find('.get-presses').prop("disabled", false);
        _this.find('.get-presses').removeClass("no-hover");
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
