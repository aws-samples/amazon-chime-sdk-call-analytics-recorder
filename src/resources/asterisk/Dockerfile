FROM --platform=linux/arm64 andrius/asterisk
RUN apk --no-cache add curl jq aws-cli
RUN aws --version
ENV VOICE_CONNECTOR=${VOICE_CONNECTOR}
ENV PHONE_NUMBER=${PHONE_NUMBER1}
ENV CLUSTER_NAME=${CLUSTER_NAME}
COPY config/* /etc/asterisk
COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh
EXPOSE 5060/udp 
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["/usr/sbin/asterisk", "-cvvvdddf", "-T", "-W", "-U", "asterisk", "-p"]


