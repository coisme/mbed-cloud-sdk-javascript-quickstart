import pexpect
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support.ui import WebDriverWait # available since 2.4.0
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC # available since 2.26.0
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.remote.remote_connection import LOGGER

import logging 
import sys
import time

elf_name = ("./mbed-cloud-client-example-sources-internal/"
            "__x86_x64_NativeLinux_mbedtls/Debug/mbedCloudClientExample.elf")
app_command = "node app.js"
app_success_pattern = 'mbed Cloud Quickstart listening at (.+)'
webapp_log_name = 'webapp_log.txt'
client_log_name = 'client_log.txt'

class TestWebApp(object):
    @classmethod
    def setup_class(cls):
        # Start the web app
        cls.webapp_child = pexpect.spawn(app_command, timeout=25)
        cls.webapp_log = open(webapp_log_name, 'wb+')
        cls.webapp_child.logfile = cls.webapp_log
        try:
            cls.webapp_child.expect(app_success_pattern)
        except:
            cls.failure("Web app failed to start")
        cls.url = cls.webapp_child.match.group(1)

        # Start the client application
        cls.client_child = pexpect.spawn(elf_name, timeout=7)
        cls.client_log = open(client_log_name, 'wb+')
        cls.client_child.logfile = cls.client_log
        index = cls.client_child.expect(['Endpoint Name: (\w+)', pexpect.EOF, pexpect.TIMEOUT])
        if index > 1:
            cls.failure("Client failed to start")
        cls.endpoint_id = cls.client_child.match.group(1)

        LOGGER.setLevel(logging.WARNING)
        # Start selenium web driver 
        cls.driver = webdriver.Firefox()
        cls.driver.get(cls.url)

    @classmethod
    def failure(cls, message):
        cls.teardown_class()
        if hasattr(cls, 'client_log'):
            cls.client_log.close()
            fd = open(client_log_name,'r+')
            print "="*5 + "Client log" + "="*5
            print fd.read()
        if hasattr(cls, 'webapp_log'):
            cls.webapp_log.close()
            fd = open(webapp_log_name,'r+')
            print "="*5 + "Webapp log" + "="*5
            print fd.read()
        assert False, message

    @classmethod
    def teardown_class(cls):
        if hasattr(cls, 'driver'):
            cls.driver.quit()
        if hasattr(cls, 'webapp_child'):
            cls.webapp_child.close()
        if hasattr(cls, 'client_child'):
            cls.client_child.close()
   
    def test_put_post(self):
        # Get the div related to the endpoint  
        try:
            endpointElement = self.driver.find_element(by=By.ID, value=self.endpoint_id)  
        except:
            assert False, "Device not shown in webapp"
        
        # Put a value in the test box
        blink_pattern_input = self.driver.find_element(by=By.ID, value=self.endpoint_id+"-blinkPattern")
        send_pattern = "100:100:100"
        blink_pattern_input.send_keys(send_pattern)    
 
        # Do a PUT
        update_button = self.driver.find_element(by=By.ID, value=self.endpoint_id+"-updatePattern")
        update_button.click()
        
        index = self.client_child.expect(['.*PUT received.*', pexpect.EOF, pexpect.TIMEOUT])
        if index > 0:   
            assert False, "Device did not receive PUT"
        

        # Do a POST
        blink_button = self.driver.find_element(by=By.ID, value=self.endpoint_id+"-blink")
        blink_button.click()
       
        # Check output on client side
        index = self.client_child.expect(['.*LED pattern = (.*)\r\nVirtual LED toggled', pexpect.EOF, pexpect.TIMEOUT])
        if index > 0: 
            self.failure("Device did not receive POST") 
        pattern_rcvd = self.client_child.match.group(1) 
        assert pattern_rcvd.strip() == send_pattern, "Expected %s Got %s"%(send_pattern, pattern_rcvd)        

    def test_get_button_press(self):
        # Send 5 button clicks
        for i in xrange(5):
            self.client_child.sendline("a")
            time.sleep(0.2)     
 
        # Get the div related to the endpoint  
        try:
            endpointElement = self.driver.find_element(by=By.ID, value=self.endpoint_id)  
        except:
            assert False, "Device not shown in webapp"
        
        # Press the GET button 
        button = endpointElement.find_element(by=By.ID, value=self.endpoint_id+"-getPresses")
        button.click()
       
        # Wait for the value to update  
        press_id = self.endpoint_id + "-presses"
        try:
            WebDriverWait(self.driver, 10).until(EC.text_to_be_present_in_element((By.ID, press_id), "5"))
        except:
            assert False, "Incorrect button count" 
 
        # Check that the value in the webapp is 5, because that's how many clicks above
        pressSpan = endpointElement.find_element(by=By.ID, value=press_id)
        print pressSpan.text
        assert pressSpan.text == '5', "Incorrect button count"  
 
