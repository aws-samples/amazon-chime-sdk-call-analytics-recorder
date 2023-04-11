FROM amazon/aws-lambda-python
COPY app.py .
COPY requirements.txt .
RUN pip install -r requirements.txt
CMD ["app.handler"]
