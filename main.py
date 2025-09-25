from flask import Flask
from Blueprints.profile.profile import profile_bp


app = Flask(__name__)
app.register_blueprint(profile_bp, url_prefix='/profile')




if __name__ == "__main__":
    app.run()