// checks if the action name matches one of our trigger words.. WOOF!
//
export const httpMethodFromAction = (action) => {
  switch(action.toLowerCase()){
    case 'show':
    case 'list': return('get')
    case 'create': return('post')
    case 'update': return('put')
    case 'destroy': return('delete')
  }
}