class RestaurantsController < ApplicationController
  before_action :set_restaurant, only: [:show, :edit, :update, :destroy]

  def yelp_search
    # params below sent from form via ajax
    type = "restaurants"
    sort = params[:sort]
    # highest rated or closest as designated on form
    lat = params[:lat]
    lon = params[:lon]
    # as calculated by getStopPoint function
    mtd = params[:mtd]
    # how far the user is willing to travel from route

    # call to Yelp API
    @restaurants = Restaurant.get_yelp(lat, lon, type, sort, mtd)

    # yelp_search.js is called at this point
    # placeRestaurantMarkers(restaurants) function drops pins for each restaurant on map
  end

  private
    # Never trust parameters from the scary internet, only allow the white list through.
    def restaurant_params
      params[:restaurant]
    end
end
