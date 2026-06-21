FROM nginx:1.29-alpine
COPY nginx-server-tokens.conf /etc/nginx/conf.d/00-server-tokens.conf
COPY index.html /usr/share/nginx/html/index.html
COPY styles.css /usr/share/nginx/html/styles.css
COPY script.js /usr/share/nginx/html/script.js
COPY assets/ /usr/share/nginx/html/assets/
EXPOSE 80
