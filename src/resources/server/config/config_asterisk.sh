#!/bin/bash -xe

PUBLIC_IP=$( jq -r '.IP' /etc/config.json )
VOICE_CONNECTOR=$( jq -r '.VOICE_CONNECTOR' /etc/config.json )
PHONE_NUMBER=$( jq -r '.PHONE_NUMBER' /etc/config.json )
TOKEN=`curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600"`
INSTANCE_ID=$( curl -H "X-aws-ec2-metadata-token: $TOKEN" -v http://169.254.169.254/latest/meta-data/instance-id )

sed -i "s/PUBLIC_IP/$PUBLIC_IP/g" /etc/asterisk/pjsip.conf
sed -i "s/VOICE_CONNECTOR/${VOICE_CONNECTOR}/g" /etc/asterisk/pjsip.conf
sed -i "s/PHONE_NUMBER/$PHONE_NUMBER/g" /etc/asterisk/extensions.conf
sed -i "s/PHONE_NUMBER/$PHONE_NUMBER/g" /etc/asterisk/pjsip.conf
sed -i "s/INSTANCE_ID/$INSTANCE_ID/g" /etc/asterisk/pjsip.conf 

echo "VOICE_CONNECTOR: ${VOICE_CONNECTOR}"
echo "PHONE_NUMBER: ${PHONE_NUMBER}"
echo "INSTANCE_ID: ${INSTANCE_ID}"


# aws chime put-voice-connector-origination --voice-connector-id ${VOICE_CONNECTOR} --origination '{"Routes": [{"Host": "'${PUBLIC_IP}'","Port": 5060,"Protocol": "UDP","Priority": 1,"Weight": 1}],"Disabled": false}'
# aws chime put-voice-connector-termination --voice-connector-id ${VOICE_CONNECTOR} --termination '{"CpsLimit": 1, "CallingRegions": ["US"], "CidrAllowedList": ["'${PUBLIC_IP}'/32"], "Disabled": false}'


usermod -aG audio,dialout asterisk
chown -R asterisk.asterisk /etc/asterisk
chown -R asterisk.asterisk /var/{lib,log,spool}/asterisk

echo '0 * * * * /sbin/asterisk -rx "core reload"' > /etc/asterisk/crontab.txt 
crontab /etc/asterisk/crontab.txt

systemctl restart asterisk
/sbin/asterisk -rx "core reload"

cd /home/ubuntu/site
yarn && yarn run build
chown ubuntu:ubuntu /home/ubuntu/site -R
systemctl enable nginx
systemctl restart nginx