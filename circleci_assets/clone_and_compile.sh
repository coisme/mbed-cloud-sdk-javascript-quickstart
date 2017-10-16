set -e
git config --global url.ssh://git@github.com/.insteadOf https://github.com/
git clone https://github.com/armmbed/mbed-cloud-client-example-sources-internal 
cd mbed-cloud-client-example-sources-internal
mbed deploy --protocol ssh
mbed update RR1.2.4-RC1
echo "$CREDENTIAL_FILE" | base64 -d > mbed_cloud_dev_credentials.c
python pal-platform/pal-platform.py -v deploy --target=x86_x64_NativeLinux_mbedtls generate
cd __x86_x64_NativeLinux_mbedtls
cmake -G "Unix Makefiles" -DCMAKE_BUILD_TYPE=Debug -DCMAKE_TOOLCHAIN_FILE=./../pal-platform/Toolchain/GCC/GCC.cmake -DEXTARNAL_DEFINE_FILE=./../define.txt
make mbedCloudClientExample.elf
cd ../..
