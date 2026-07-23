import {ImageResponse} from 'next/og';

export const size={width:1200,height:630};
export const contentType='image/png';

export default function OpenGraphImage(){
 return new ImageResponse(
  <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:'#172033',color:'#ffffff',fontSize:160,fontWeight:800,letterSpacing:-6}}>
   CRM
  </div>,
  size
 );
}
