import { httpMethodFromAction } from './configBuilder'

describe('#httpMethodFromAction', () => {
  it('return the correct method for a given action', async () => {
    expect(httpMethodFromAction('show')).toEqual('get')
    expect(httpMethodFromAction('list')).toEqual('get')
    expect(httpMethodFromAction('create')).toEqual('post')
    expect(httpMethodFromAction('update')).toEqual('put')
    expect(httpMethodFromAction('destroy')).toEqual('delete')
  })
})