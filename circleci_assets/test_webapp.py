import pexpect
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support.ui import WebDriverWait # available since 2.4.0
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC # available since 2.26.0
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.remote.remote_connection import LOGGER

import logging 

elf_name = ("./mbed-cloud-client-example-internal/"
            "__x86_x64_NativeLinux_mbedtls/Debug/mbedCloudClientExample.elf")
app_command = "node app.js"
app_success_pattern = 'mbed Cloud Quickstart listening at (.+)'

class TestWebApp(object):

    def setup(self):
        # Start the web app
        self.webapp_child = pexpect.spawn(app_command, timeout=25)
        try:
            self.webapp_child.expect(app_success_pattern)
        except:
            assert False, "Web app failed to start"
        self.url = self.webapp_child.match.group(1)

        # Start the client application
        self.client_child = pexpect.spawn(elf_name, timeout=7)
        index = self.client_child.expect(['Endpoint Name: (\w+)', pexpect.EOF, pexpect.TIMEOUT])
        if index > 1:
            assert False, "Client failed to start"
        self.endpoint_id = self.client_child.match.group(1)


        LOGGER.setLevel(logging.WARNING)
        # Start selenium web driver 
        self.driver = webdriver.Firefox()
        self.driver.get(self.url)

    def teardown(self):
        self.driver.quit()
        self.webapp_child.close()
        self.client_child.close()
    
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
        index = self.client_child.expect(['.*LED pattern = (.*)\r\nBlink!', pexpect.EOF, pexpect.TIMEOUT])
        if index > 0:  
            assert False, "Device did not receive POST"
        pattern_rcvd = self.client_child.match.group(1) 
        assert pattern_rcvd.strip() == send_pattern, "Expected %s Got %s"%(send_pattern, pattern_rcvd)        

    def test_get_button_press(self):
        # Send 5 button clicks
        for i in xrange(5):
            self.client_child.sendline("a")
            self.client_child.expect(">>")
            assert (self.client_child.match is not None)
      
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
 
