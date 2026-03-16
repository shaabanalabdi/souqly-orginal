import { requestData } from './client';
import type { Country, CountryCities, NearestCityResult } from '../types/domain';

export const geoService = {
  listCountries() {
    return requestData<Country[]>({
      method: 'GET',
      url: '/geo/countries',
    });
  },

  listCountryCities(countryCode: string) {
    return requestData<CountryCities>({
      method: 'GET',
      url: `/geo/countries/${countryCode}/cities`,
    });
  },

  getNearestCity(lat: number, lng: number) {
    return requestData<NearestCityResult>({
      method: 'GET',
      url: '/geo/nearest-city',
      params: { lat, lng },
    });
  },
};
